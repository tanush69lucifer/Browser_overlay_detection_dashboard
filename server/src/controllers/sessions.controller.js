const Exam = require('../models/Exam');
const User = require('../models/User');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { loadExamForStaff } = require('../utils/access');
const { ok, paginate } = require('../utils/response');
const counters = require('../redis/counters');
const { emitToExam } = require('../realtime/io');

// Candidate starts (or resumes) their monitored session. One session per candidate per exam.
const startSession = asyncHandler(async (req, res) => {
  const examId = req.params.id;
  const candidateId = req.user.id;

  const exam = await Exam.findById(examId).select('candidateIds startAt endAt').lean();
  if (!exam || !exam.candidateIds.some((id) => String(id) === candidateId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
  }
  const now = new Date();
  if (now < exam.startAt) throw new ApiError(409, 'EXAM_NOT_STARTED', 'This exam has not started yet');
  if (now > exam.endAt) throw new ApiError(409, 'EXAM_ENDED', 'This exam window has closed');

  const existing = await Session.findOne({ examId, candidateId }).lean();
  if (existing) {
    if (existing.status === 'ENDED') throw new ApiError(409, 'CONFLICT', 'You have already submitted this exam');
    return ok(res, { sessionId: existing._id, examId, startedAt: existing.startedAt, resumed: true });
  }

  let session;
  try {
    session = await Session.create({
      examId,
      candidateId,
      status: 'OFFLINE', // becomes ONLINE when the socket sends session:join
      userAgent: req.body.userAgent,
      screen: req.body.screen,
    });
  } catch (err) {
    // Two tabs started at the same moment: the unique index lets only one win.
    if (err.code !== 11000) throw err;
    session = await Session.findOne({ examId, candidateId });
  }

  ok(res, { sessionId: session._id, examId, startedAt: session.startedAt, resumed: false }, { status: 201 });
});

const endSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, candidateId: req.user.id });
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');

  if (session.status !== 'ENDED') {
    session.status = 'ENDED';
    session.endedAt = new Date();
    session.answers = req.body.answers;
    await session.save();

    const examId = String(session.examId);
    await counters.setOffline(examId, String(session._id));
    emitToExam(examId, 'session:status', { sessionId: String(session._id), status: 'ENDED' });
  }

  ok(res, { session: { _id: session._id, status: session.status, endedAt: session.endedAt } }, { message: 'Exam submitted' });
});

// Proctor grid: all sessions of an exam (up to 500 per page).
const listExamSessions = asyncHandler(async (req, res) => {
  const exam = await loadExamForStaff(req.params.id, req.user);
  const { page, limit, search, status, sort } = req.query;

  const filter = { examId: exam._id };
  if (status) filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const matches = await User.find({ _id: { $in: exam.candidateIds }, $or: [{ name: rx }, { email: rx }] })
      .select('_id')
      .lean();
    filter.candidateId = { $in: matches.map((m) => m._id) };
  }

  const [docs, total] = await Promise.all([
    Session.find(filter)
      .select('-answers')
      .populate('candidateId', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Session.countDocuments(filter),
  ]);

  const items = docs.map(({ candidateId, ...s }) => ({ ...s, candidate: candidateId }));
  ok(res, paginate(items, total, page, limit));
});

const getSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).select('-answers').populate('candidateId', 'name email').lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');

  const exam = await loadExamForStaff(session.examId, req.user);
  const { candidateId, ...rest } = session;
  ok(res, { session: { ...rest, candidate: candidateId, exam: { _id: exam._id, title: exam.title } } });
});

module.exports = { startSession, endSession, listExamSessions, getSession };
