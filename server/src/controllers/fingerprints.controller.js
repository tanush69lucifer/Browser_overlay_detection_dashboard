const Fingerprint = require('../models/Fingerprint');
const Threshold = require('../models/Threshold');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paginate } = require('../utils/response');
const configCache = require('../scoring/configCache');
<<<<<<< HEAD

const getActiveFingerprints = asyncHandler(async (req, res) => {
  const fingerprints = await Fingerprint.find({ isActive: true }).sort({ tool: 1 }).lean();
  ok(res, fingerprints);
});

const listFingerprints = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const filter = req.query.search
    ? { $or: [
      { name: { $regex: escapeRegex(req.query.search), $options: 'i' } },
      { tool: { $regex: escapeRegex(req.query.search), $options: 'i' } },
    ] }
    : {};
  const [items, total] = await Promise.all([
    Fingerprint.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
=======
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
>>>>>>> origin/main
    Fingerprint.countDocuments(filter),
  ]);
  ok(res, paginate(items, total, page, limit));
});

<<<<<<< HEAD
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
=======
const getActiveFingerprints = asyncHandler(async (req, res) => {
  ok(res, { items: await Fingerprint.find({ isActive: true }).sort({ tool: 1 }).lean() });
});
>>>>>>> origin/main

const createFingerprint = asyncHandler(async (req, res) => {
  const fingerprint = await Fingerprint.create(req.body);
  configCache.clearCache();
<<<<<<< HEAD
  ok(res, { fingerprint }, { status: 201, message: 'Fingerprint created' });
=======
  ok(res, { fingerprint }, { status: 201 });
>>>>>>> origin/main
});

const updateFingerprint = asyncHandler(async (req, res) => {
  const fingerprint = await Fingerprint.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
<<<<<<< HEAD
  });
  if (!fingerprint) throw new ApiError(404, 'NOT_FOUND', 'Fingerprint not found');
  configCache.clearCache();
  ok(res, { fingerprint }, { message: 'Fingerprint updated' });
});

const listThresholds = asyncHandler(async (req, res) => {
  const items = await Threshold.find({}).sort({ sensitivity: 1 }).lean();
  ok(res, { items });
=======
  }).lean();
  if (!fingerprint) throw new ApiError(404, 'NOT_FOUND', 'Fingerprint not found');
  configCache.clearCache();
  ok(res, { fingerprint });
});

const listThresholds = asyncHandler(async (req, res) => {
  ok(res, { items: await Threshold.find({}).sort({ sensitivity: 1 }).lean() });
>>>>>>> origin/main
});

const updateThreshold = asyncHandler(async (req, res) => {
  const threshold = await Threshold.findOneAndUpdate(
    { sensitivity: req.params.sensitivity },
    { $set: req.body, $setOnInsert: { sensitivity: req.params.sensitivity } },
<<<<<<< HEAD
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
=======
    { new: true, upsert: true, runValidators: true }
  ).lean();
>>>>>>> origin/main
  configCache.clearCache();
  ok(res, { threshold });
});

module.exports = {
<<<<<<< HEAD
  getActiveFingerprints,
  listFingerprints,
=======
  listFingerprints,
  getActiveFingerprints,
>>>>>>> origin/main
  createFingerprint,
  updateFingerprint,
  listThresholds,
  updateThreshold,
};
