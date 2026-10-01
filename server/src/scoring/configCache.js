// Cached loader for active fingerprints, thresholds, and exam sensitivity.
// Refreshes from MongoDB every 30 seconds to avoid database round-trips on every signal batch.

const Fingerprint = require('../models/Fingerprint');
const Threshold = require('../models/Threshold');
const Exam = require('../models/Exam');
const { DEFAULT_THRESHOLDS } = require('./weights');

const CACHE_TTL_MS = 30 * 1000;

let fingerprintsCache = null;
let fingerprintsLoadedAt = 0;

let thresholdsCache = null;
let thresholdsLoadedAt = 0;

const examSensitivityCache = new Map();

async function loadActiveFingerprints() {
  const now = Date.now();
  if (fingerprintsCache && now - fingerprintsLoadedAt < CACHE_TTL_MS) {
    return fingerprintsCache;
  }
  try {
    const list = await Fingerprint.find({ isActive: true }).lean();
    fingerprintsCache = list;
    fingerprintsLoadedAt = now;
  } catch (err) {
    if (!fingerprintsCache) fingerprintsCache = [];
  }
  return fingerprintsCache;
}

async function getFingerprintByTool(tool) {
  if (!tool) return null;
  const list = await loadActiveFingerprints();
  return list.find((f) => f.tool === tool) || null;
}

async function loadThresholds() {
  const now = Date.now();
  if (thresholdsCache && now - thresholdsLoadedAt < CACHE_TTL_MS) {
    return thresholdsCache;
  }

  const map = {
    LOW: { ...DEFAULT_THRESHOLDS.LOW },
    MEDIUM: { ...DEFAULT_THRESHOLDS.MEDIUM },
    HIGH: { ...DEFAULT_THRESHOLDS.HIGH },
  };

  try {
    const docs = await Threshold.find({}).lean();
    for (const doc of docs) {
      if (doc.sensitivity) {
        map[doc.sensitivity] = {
          windowMs: doc.windowMs ?? DEFAULT_THRESHOLDS[doc.sensitivity]?.windowMs ?? 60000,
          flagScore: doc.flagScore ?? DEFAULT_THRESHOLDS[doc.sensitivity]?.flagScore ?? 8,
        };
      }
    }
    thresholdsCache = map;
    thresholdsLoadedAt = now;
  } catch (err) {
    if (!thresholdsCache) thresholdsCache = map;
  }

  return thresholdsCache;
}

async function getThreshold(sensitivity = 'MEDIUM') {
  const map = await loadThresholds();
  return (
    map[sensitivity] ||
    DEFAULT_THRESHOLDS[sensitivity] ||
    DEFAULT_THRESHOLDS.MEDIUM
  );
}

async function getExamSensitivity(examId) {
  if (!examId) return 'MEDIUM';
  const key = String(examId);
  const now = Date.now();

  const cached = examSensitivityCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached.sensitivity;
  }

  let sensitivity = 'MEDIUM';
  try {
    const exam = await Exam.findById(examId).select('sensitivity').lean();
    if (exam && exam.sensitivity) {
      sensitivity = exam.sensitivity;
    }
  } catch (err) {
    // Keep default MEDIUM on error
  }

  examSensitivityCache.set(key, {
    sensitivity,
    expiresAt: now + CACHE_TTL_MS,
  });

  return sensitivity;
}

function clearCache() {
  fingerprintsCache = null;
  fingerprintsLoadedAt = 0;
  thresholdsCache = null;
  thresholdsLoadedAt = 0;
  examSensitivityCache.clear();
}

module.exports = {
  loadActiveFingerprints,
  getFingerprintByTool,
  loadThresholds,
  getThreshold,
  getExamSensitivity,
  clearCache,
};
