// Controller for detector fingerprint queries and admin fingerprint/threshold management.

const Fingerprint = require('../models/Fingerprint');
const Threshold = require('../models/Threshold');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paginate } = require('../utils/response');
const { DEFAULT_THRESHOLDS } = require('../scoring/weights');
const configCache = require('../scoring/configCache');

/**
 * GET /fingerprints/active
 * Accessible by any logged-in user (needed by candidate exam page detector).
 */
const getActiveFingerprints = asyncHandler(async (req, res) => {
  const fingerprints = await Fingerprint.find({ isActive: true })
    .select('-__v')
    .lean();

  return ok(res, { items: fingerprints });
});

/**
 * GET /admin/fingerprints
 * Paginated list of fingerprints with optional text search (Admin only).
 */
const listFingerprints = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 20));
  const search = req.query.search?.trim();

  const filter = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { tool: { $regex: escaped, $options: 'i' } },
      { matcher: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Fingerprint.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Fingerprint.countDocuments(filter),
  ]);

  return ok(res, paginate(items, total, page, limit));
});

/**
 * POST /admin/fingerprints
 * Creates a new fingerprint pattern and invalidates the config cache (Admin only).
 */
const createFingerprint = asyncHandler(async (req, res) => {
  const fingerprint = await Fingerprint.create(req.body);
  configCache.clearCache();
  return ok(res, fingerprint, { status: 201 });
});

/**
 * PATCH /admin/fingerprints/:id
 * Updates an existing fingerprint pattern and invalidates cache (Admin only).
 */
const updateFingerprint = asyncHandler(async (req, res) => {
  const fingerprint = await Fingerprint.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!fingerprint) {
    throw new ApiError(404, 'NOT_FOUND', 'Fingerprint not found');
  }

  configCache.clearCache();
  return ok(res, fingerprint);
});

/**
 * GET /admin/thresholds
 * Lists sensitivity thresholds, falling back to defaults if not yet seeded (Admin only).
 */
const listThresholds = asyncHandler(async (req, res) => {
  const docs = await Threshold.find({}).lean();
  const docMap = new Map(docs.map((d) => [d.sensitivity, d]));

  const sensitivities = ['LOW', 'MEDIUM', 'HIGH'];
  const items = sensitivities.map((sens) => {
    if (docMap.has(sens)) return docMap.get(sens);
    return {
      sensitivity: sens,
      windowMs: DEFAULT_THRESHOLDS[sens].windowMs,
      flagScore: DEFAULT_THRESHOLDS[sens].flagScore,
      isDefault: true,
    };
  });

  return ok(res, { items });
});

/**
 * PATCH /admin/thresholds/:sensitivity
 * Updates windowMs and flagScore for a given sensitivity tier (Admin only).
 */
const updateThreshold = asyncHandler(async (req, res) => {
  const { sensitivity } = req.params;
  const { windowMs, flagScore } = req.body;

  const update = {};
  if (windowMs !== undefined) update.windowMs = windowMs;
  if (flagScore !== undefined) update.flagScore = flagScore;

  const threshold = await Threshold.findOneAndUpdate(
    { sensitivity },
    { $set: update },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  configCache.clearCache();
  return ok(res, threshold);
});

module.exports = {
  getActiveFingerprints,
  listFingerprints,
  createFingerprint,
  updateFingerprint,
  listThresholds,
  updateThreshold,
};
