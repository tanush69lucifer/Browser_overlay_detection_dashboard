const Flag = require('../models/Flag');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
<<<<<<< HEAD
const { loadExamForStaff } = require('../utils/access');
const { ok, paginate } = require('../utils/response');
const { processBatch } = require('../scoring/score');
=======
const { processBatch } = require('../scoring/score');
const { ok } = require('../utils/response');
const { loadExamForStaff } = require('../utils/access');
const { emitToExam } = require('../realtime/io');
const toProctorSignal = require('../utils/proctorSignal');
>>>>>>> origin/main

const getSessionFlags = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).select('examId').lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  await loadExamForStaff(session.examId, req.user);
<<<<<<< HEAD

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const filter = { sessionId: session._id };
  const [items, total] = await Promise.all([
    Flag.find(filter).sort({ raisedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Flag.countDocuments(filter),
  ]);
  ok(res, paginate(items, total, page, limit));
=======
  const flags = await Flag.find({ sessionId: session._id }).sort({ raisedAt: -1 }).lean();
  ok(res, { items: flags });
>>>>>>> origin/main
});

const patchFlag = asyncHandler(async (req, res) => {
  const flag = await Flag.findById(req.params.id);
  if (!flag) throw new ApiError(404, 'NOT_FOUND', 'Flag not found');
  await loadExamForStaff(flag.examId, req.user);
<<<<<<< HEAD
  for (const field of ['reviewed', 'note', 'verdict']) {
    if (req.body[field] !== undefined) flag[field] = req.body[field];
  }
  if (req.body.reviewed === true || req.body.verdict !== undefined) flag.reviewedBy = req.user.id;
  await flag.save();
  ok(res, { flag });
=======
  if (req.body.note !== undefined) flag.note = req.body.note;
  if (req.body.verdict !== undefined) flag.verdict = req.body.verdict;
  flag.reviewed = req.body.reviewed === undefined ? true : req.body.reviewed;
  flag.reviewedBy = flag.reviewed ? req.user.id : null;
  await flag.save();
  emitToExam(String(flag.examId), 'flag:updated', { flag: flag.toObject() });
  ok(res, { flag: flag.toObject() });
>>>>>>> origin/main
});

const postSignals = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, candidateId: req.user.id }).lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');
<<<<<<< HEAD
  if (session.status === 'ENDED') throw new ApiError(409, 'SESSION_ENDED', 'This exam session has ended');
  const { flags } = await processBatch({
    sessionId: String(session._id),
    examId: String(session.examId),
    candidate: { id: req.user.id, name: req.user.name },
    signals: req.body.signals,
  });
  ok(res, { accepted: req.body.signals.length, flags });
=======
  const result = await processBatch({
    sessionId: session._id,
    examId: session.examId,
    candidate: { id: req.user.id, name: req.user.name },
    signals: req.body.signals,
  });
  for (const signal of result.signals) {
    const event = toProctorSignal(signal, String(session._id), req.user);
    if (event) emitToExam(String(session.examId), 'signal:new', event);
  }
  for (const flag of result.flags) emitToExam(String(session.examId), 'flag:new', flag);
  if (result.flags.length) {
    const rank = { LOW: 1, MED: 2, HIGH: 3 };
    const highest = result.flags.reduce((current, flag) =>
      rank[flag.severity] > rank[current.severity] ? flag : current
    );
    emitToExam(String(session.examId), 'session:status', {
      sessionId: String(session._id),
      status: 'FLAGGED',
      maxSeverity: highest.severity,
    });
  }
  ok(res, { flags: result.flags.length });
>>>>>>> origin/main
});

module.exports = { getSessionFlags, patchFlag, postSignals };
