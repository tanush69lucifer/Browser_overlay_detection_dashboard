const Fingerprint = require('../models/Fingerprint');
const Threshold = require('../models/Threshold');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paginate } = require('../utils/response');
const configCache = require('../scoring/configCache');
const escapeRegex = require('../utils/escapeRegex');

const listFingerprints = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const filter = search
    ? {
        $or: [
          { name: new RegExp(escapeRegex(search), 'i') },
          { tool: new RegExp(escapeRegex(search), 'i') },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    Fingerprint.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Fingerprint.countDocuments(filter),
  ]);
  ok(res, paginate(items, total, page, limit));
});

const getActiveFingerprints = asyncHandler(async (req, res) => {
  ok(res, { items: await Fingerprint.find({ isActive: true }).sort({ tool: 1 }).lean() });
});

const createFingerprint = asyncHandler(async (req, res) => {
  const fingerprint = await Fingerprint.create(req.body);
  configCache.clearCache();
  ok(res, { fingerprint }, { status: 201 });
});

const updateFingerprint = asyncHandler(async (req, res) => {
  const fingerprint = await Fingerprint.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).lean();
  if (!fingerprint) throw new ApiError(404, 'NOT_FOUND', 'Fingerprint not found');
  configCache.clearCache();
  ok(res, { fingerprint });
});

const listThresholds = asyncHandler(async (req, res) => {
  ok(res, { items: await Threshold.find({}).sort({ sensitivity: 1 }).lean() });
});

const updateThreshold = asyncHandler(async (req, res) => {
  const threshold = await Threshold.findOneAndUpdate(
    { sensitivity: req.params.sensitivity },
    { $set: req.body, $setOnInsert: { sensitivity: req.params.sensitivity } },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  configCache.clearCache();
  ok(res, { threshold });
});

module.exports = {
  listFingerprints,
  getActiveFingerprints,
  createFingerprint,
  updateFingerprint,
  listThresholds,
  updateThreshold,
};
