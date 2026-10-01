// Scoring engine implementation per SPEC section 7.
// Validates signals, debounces, weights, evaluates sliding window, and emits at most one flag per batch.

const mongoose = require('mongoose');
const Session = require('../models/Session');
const Exam = require('../models/Exam');
const DetectorSignal = require('../models/DetectorSignal');
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

/**
 * Sanitizes meta object to ensure small primitives only, never HTML or raw candidate text.
 *
 * @param {any} meta
 * @returns {Object}
 */
function sanitizeMeta(meta, code) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  if (code === 'BROWSER_TAB_SWITCH') {
    let url;
    try {
      const parsed = new URL(meta.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return {};
      url = `${parsed.origin}${parsed.pathname}`.slice(0, 200);
    } catch {
      return {};
    }
    const title = typeof meta.title === 'string'
      ? meta.title.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120)
      : '';
    return {
      url,
      title,
      isExamTab: meta.isExamTab === true,
    };
  }
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
    return { flags: [], signals: [] };
  }

  const now = Date.now();
  const [session, exam] = await Promise.all([
    Session.findById(sessionId).select('examId startedAt endedAt').lean(),
    Exam.findById(examId).select('startAt endAt fingerprintIds').lean(),
  ]);
  if (!session || !exam || String(session.examId) !== String(examId)) {
    return { flags: [], signals: [] };
  }

  const earliestSignal = Math.max(
    new Date(session.startedAt).getTime(),
    new Date(exam.startAt).getTime()
  );
  const latestSignal = Math.min(
    session.endedAt ? new Date(session.endedAt).getTime() : now,
    new Date(exam.endAt).getTime(),
    now
  );
  if (!Number.isFinite(earliestSignal) || !Number.isFinite(latestSignal) || earliestSignal > latestSignal) {
    return { flags: [], signals: [] };
  }

  const countedSignals = [];
  const acceptedSignals = [];

  // Step 1: Validate, sanitize, debounce, and assign weight/severity
  for (const sig of signals) {
    if (!sig || typeof sig !== 'object') continue;
    if (!KNOWN_CODES.has(sig.code)) continue;

    const t = typeof sig.t === 'number' && Number.isFinite(sig.t) && sig.t > 0 ? sig.t : now;
    if (t < earliestSignal || t > latestSignal) continue;
    const cleanKey = sig.key ? String(sig.key).slice(0, 200) : undefined;
    const cleanMeta = sanitizeMeta(sig.meta, sig.code);
    if (sig.code === 'BROWSER_TAB_SWITCH' && !cleanMeta.url) continue;

    // Rule 1: Debounce (skip if debounce exists, TTL 60s for keyed, 10s for keyless)
    const allowed = await shouldCount(sessionId, sig.code, cleanKey);
    if (!allowed) continue;

    // Rule 2: Weight and severity calculation
    let weight = DEFAULT_WEIGHTS[sig.code] || 1;
    let severity = DEFAULT_SEVERITY[sig.code] || 'LOW';

    if (sig.code === 'KNOWN_FINGERPRINT') {
      const toolName = cleanMeta.tool;
      const fp = await configCache.getFingerprintByTool(toolName);
      // Every active configured fingerprint applies to every exam; per-exam
      // fingerprint selections must not silently disable active detections.
      if (fp?.allowed) {
        weight = 1;
        severity = 'LOW';
      } else if (fp) {
        weight = Number(fp.weight) || 10;
        severity = fp.severity || 'HIGH';
      }
    } else if (sig.code === 'EXTENSION_RESOURCE_PROBE') {
      const configuredTool = cleanMeta.tool;
      const fp = await configCache.getFingerprintByTool(configuredTool);
      if (fp && fp.matcherType !== 'EXTENSION_RESOURCE') {
        acceptedSignals.push({
          code: sig.code,
          severity: ['LOW', 'MED', 'HIGH'].includes(sig.severity) ? sig.severity : DEFAULT_SEVERITY[sig.code],
          t,
          key: cleanKey,
          meta: cleanMeta,
        });
        continue;
      }
      if (fp?.allowed) {
        weight = 1;
        severity = 'LOW';
      } else if (fp) {
        weight = Number(fp.weight) || DEFAULT_WEIGHTS[sig.code];
        severity = fp.severity || DEFAULT_SEVERITY[sig.code];
      }
    } else if (sig.code === 'FIXED_HIGH_Z_NODE') {
      const zIndex = Number(cleanMeta.zIndex);
      const areaRatio = Number(cleanMeta.areaRatio);
      const persistentMs = Number(cleanMeta.persistentMs);
      const isPersistentLargeOverlay =
        zIndex > 9999 && areaRatio >= 0.05 && persistentMs >= 5000;
      weight = isPersistentLargeOverlay ? 10 : DEFAULT_WEIGHTS.FIXED_HIGH_Z_NODE;
      severity = isPersistentLargeOverlay ? 'HIGH' : DEFAULT_SEVERITY.FIXED_HIGH_Z_NODE;
    }

    // Keep a sanitized copy for the proctor feed. It remains visible even
    // when it does not accumulate enough score to raise a flag.
    acceptedSignals.push({
      code: sig.code,
      severity,
      t,
      key: cleanKey,
      meta: cleanMeta,
    });

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
    const candidateId = candidate?.id || candidate?._id || candidate;
    if (acceptedSignals.length && candidateId) {
      await DetectorSignal.insertMany(acceptedSignals.map((signal) => ({
        sessionId,
        examId,
        candidateId,
        code: signal.code,
        severity: signal.severity,
        occurredAt: new Date(signal.t),
        meta: signal.meta,
      })), { ordered: false });
    }
    return { flags: [], signals: acceptedSignals };
  }

  const candidateId = candidate?.id || candidate?._id || candidate;
  if (acceptedSignals.length && candidateId) {
    await DetectorSignal.insertMany(acceptedSignals.map((signal) => ({
      sessionId,
      examId,
      candidateId,
      code: signal.code,
      severity: signal.severity,
      occurredAt: new Date(signal.t),
      meta: signal.meta,
    })), { ordered: false });
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
    return { flags: [], signals: acceptedSignals };
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

  return { flags: [resultFlag], signals: acceptedSignals };
}

module.exports = { processBatch };
