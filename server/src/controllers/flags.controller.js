const Flag = require('../models/Flag');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { loadExamForStaff } = require('../utils/access');
const { ok, paginate } = require('../utils/response');
const { processBatch } = require('../scoring/score');

const getSessionFlags = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).select('examId').lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  await loadExamForStaff(session.examId, req.user);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const filter = { sessionId: session._id };
  const [items, total] = await Promise.all([
    Flag.find(filter).sort({ raisedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Flag.countDocuments(filter),
  ]);
  ok(res, paginate(items, total, page, limit));
});

const patchFlag = asyncHandler(async (req, res) => {
  const flag = await Flag.findById(req.params.id);
  if (!flag) throw new ApiError(404, 'NOT_FOUND', 'Flag not found');
  await loadExamForStaff(flag.examId, req.user);
  for (const field of ['reviewed', 'note', 'verdict']) {
    if (req.body[field] !== undefined) flag[field] = req.body[field];
  }
  if (req.body.reviewed === true || req.body.verdict !== undefined) flag.reviewedBy = req.user.id;
  await flag.save();
  ok(res, { flag });
});

const postSignals = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, candidateId: req.user.id }).lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  if (session.status === 'ENDED') throw new ApiError(409, 'SESSION_ENDED', 'This exam session has ended');
  const { flags } = await processBatch({
    sessionId: String(session._id),
    examId: String(session.examId),
    candidate: { id: req.user.id, name: req.user.name },
    signals: req.body.signals,
  });
  ok(res, { accepted: req.body.signals.length, flags });
});

module.exports = { getSessionFlags, patchFlag, postSignals };
