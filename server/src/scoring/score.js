// Scoring engine implementation per SPEC section 7.
// Validates signals, debounces, weights, evaluates sliding window, and emits at most one flag per batch.

const mongoose = require('mongoose');
const Session = require('../models/Session');
const counters = require('../redis/counters');
const signalWindow = require('../redis/signalWindow');
const { shouldCount } = require('./debounce');
const configCache = require('./configCache');
const flagWriter = require('./flagWriter');
const {
  DEFAULT_WEIGHTS,
  DEFAULT_SEVERITY,
} = require('./weights');

const KNOWN_CODES = new Set(Object.keys(DEFAULT_WEIGHTS));
const SESSION_CACHE_TTL_MS = 10 * 1000;
const sessionStatusCache = new Map();

/**
 * Checks whether the session is active or ended (cached for 10 s).
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>} - true if session is ENDED, false if active
 */
async function isSessionEnded(sessionId) {
  if (!sessionId) return true;
  const key = String(sessionId);
  const now = Date.now();

  const cached = sessionStatusCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached.status === 'ENDED';
  }

  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  let status = 'ONLINE';
  try {
    const session = await Session.findById(sessionId).select('status').lean();
    if (!session || session.status === 'ENDED') {
      status = 'ENDED';
    } else {
      status = session.status;
    }
  } catch (err) {
    // If lookup fails, treat as active to avoid dropping legit signals
  }

  sessionStatusCache.set(key, {
    status,
    expiresAt: now + SESSION_CACHE_TTL_MS,
  });

  return status === 'ENDED';
}

/**
 * Sanitizes meta object to ensure small primitives only, never HTML or raw candidate text.
 *
 * @param {any} meta
 * @returns {Object}
 */
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const clean = {};
  for (const [k, v] of Object.entries(meta)) {
    if (['string', 'number', 'boolean'].includes(typeof v)) {
      if (typeof v === 'string') {
        clean[k] = v.slice(0, 200); // prevent oversized strings
      } else {
        clean[k] = v;
      }
    }
  }
  return clean;
}

/**
 * Processes a batch of integrity signals from a candidate session.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.examId
 * @param {Object} params.candidate - { id, name }
 * @param {Array<Object>} params.signals - [{ code, severity, t, key, meta }]
 * @returns {Promise<{ flags: Array<Object> }>}
 */
async function processBatch({ sessionId, examId, candidate, signals = [] }) {
  if (!sessionId || !examId || !Array.isArray(signals) || signals.length === 0) {
    return { flags: [] };
  }

  // Rule 7: Ignore batches for sessions that are ENDED (cached 10 s)
  if (await isSessionEnded(sessionId)) {
    return { flags: [] };
  }

  const now = Date.now();
  const countedSignals = [];

  // Step 1: Validate, sanitize, debounce, and assign weight/severity
  for (const sig of signals) {
    if (!sig || typeof sig !== 'object') continue;
    if (!KNOWN_CODES.has(sig.code)) continue;

    const t = typeof sig.t === 'number' && sig.t > 0 ? sig.t : now;
    const cleanKey = sig.key ? String(sig.key).slice(0, 200) : undefined;
    const cleanMeta = sanitizeMeta(sig.meta);

    // Rule 1: Debounce (skip if debounce exists, TTL 60s for keyed, 10s for keyless)
    const allowed = await shouldCount(sessionId, sig.code, cleanKey);
    if (!allowed) continue;

    // Rule 2: Weight and severity calculation
    let weight = DEFAULT_WEIGHTS[sig.code] || 1;
    let severity = DEFAULT_SEVERITY[sig.code] || 'LOW';

    if (sig.code === 'KNOWN_FINGERPRINT') {
      const toolName = cleanMeta.tool;
      const fp = await configCache.getFingerprintByTool(toolName);
      if (fp) {
        if (fp.allowed) {
          weight = 1;
          severity = 'LOW';
        } else {
          weight = Number(fp.weight) || 10;
          severity = fp.severity || 'HIGH';
        }
      }
    }

    countedSignals.push({
      code: sig.code,
      severity,
      weight,
      t,
      key: cleanKey,
      meta: cleanMeta,
    });
  }

  if (countedSignals.length === 0) {
    return { flags: [] };
  }

  // Step 2: Load exam thresholds
  const sensitivity = await configCache.getExamSensitivity(examId);
  const threshold = await configCache.getThreshold(sensitivity);
  const windowMs = threshold.windowMs || 60000;
  const flagScoreThreshold = threshold.flagScore || 8;

  // Step 3: Add to sliding window
  const windowEntries = countedSignals.map((s) => ({
    weight: s.weight,
    severity: s.severity,
    t: s.t,
  }));
  const { sum: windowSum, hasMed } = await signalWindow.add(sessionId, windowEntries, windowMs);

  // Step 4: Raise at most one flag per batch
  const highSignal = countedSignals.find((s) => s.severity === 'HIGH');
  let flagRaised = false;
  let flagSeverity = 'LOW';
  let flagScore = 0;
  let clearWindowNeeded = false;

  if (highSignal) {
    flagRaised = true;
    flagSeverity = 'HIGH';
    flagScore = Math.max(highSignal.weight, windowSum);
    clearWindowNeeded = true;
  } else if (windowSum >= flagScoreThreshold) {
    flagRaised = true;
    flagSeverity = hasMed ? 'MED' : 'LOW';
    flagScore = windowSum;
    clearWindowNeeded = true;
  }

  if (!flagRaised) {
    return { flags: [] };
  }

  if (clearWindowNeeded) {
    await signalWindow.clear(sessionId);
  }

  // Step 5: Flag code = code of the highest-weight signal
  const topSignal = countedSignals.reduce(
    (best, s) => (s.weight > best.weight ? s : best),
    countedSignals[0]
  );
  const flagCode = topSignal.code;

  // Step 6: Pre-generate _id, enqueue to flagWriter buffer, mark counters, return flag
  const flagId = new mongoose.Types.ObjectId();
  const candidateId = candidate?.id || candidate?._id || candidate;
  const candidateName = candidate?.name || 'Candidate';

  const evidence = {
    signals: countedSignals.map((s) => ({
      code: s.code,
      severity: s.severity,
      t: s.t,
      meta: s.meta,
    })),
    ...(topSignal.meta?.tool ? { tool: topSignal.meta.tool } : {}),
  };

  const flagDoc = {
    _id: flagId,
    sessionId: new mongoose.Types.ObjectId(String(sessionId)),
    examId: new mongoose.Types.ObjectId(String(examId)),
    candidateId: new mongoose.Types.ObjectId(String(candidateId)),
    code: flagCode,
    severity: flagSeverity,
    score: flagScore,
    evidence,
    raisedAt: new Date(now),
    reviewed: false,
    reviewedBy: null,
    note: '',
    verdict: null,
  };

  flagWriter.enqueue(flagDoc);

  // Update real-time live counters in Redis/Memory
  await counters.markFlagged(examId, sessionId, flagSeverity);

  const resultFlag = {
    _id: flagId,
    sessionId: String(sessionId),
    examId: String(examId),
    candidate: {
      id: String(candidateId),
      name: candidateName,
    },
    severity: flagSeverity,
    code: flagCode,
    score: flagScore,
    t: now,
    evidence,
  };

  return { flags: [resultFlag] };
}

module.exports = { processBatch };
