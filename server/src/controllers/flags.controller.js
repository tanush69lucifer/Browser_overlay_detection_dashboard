// Controller for flag retrieval, flag reviews, and HTTP signal fallback.
// Enforces role-based exam authorization and realtime event emission.

const Session = require('../models/Session');
const Flag = require('../models/Flag');
const Exam = require('../models/Exam');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { emitToExam } = require('../realtime/io');
const { processBatch } = require('../scoring/score');

/**
 * Ensures user is an ADMIN or a PROCTOR assigned to the exam.
 */
async function ensureExamStaffAccess(examId, user) {
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Login required');
  if (user.role === 'ADMIN') return;
  if (user.role === 'PROCTOR') {
    const exam = await Exam.findById(examId).select('proctorIds').lean();
    if (!exam) throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
    const isAssigned = exam.proctorIds?.some((id) => String(id) === String(user.id));
    if (!isAssigned) {
      throw new ApiError(403, 'FORBIDDEN', 'You are not assigned to proctor this exam');
    }
    return;
  }
  throw new ApiError(403, 'FORBIDDEN', 'Access denied');
}

/**
 * GET /sessions/:id/flags
 * Retrieves all flags for a session, sorted by raisedAt ascending.
 */
const getSessionFlags = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).select('examId candidateId').lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');

  await ensureExamStaffAccess(session.examId, req.user);

  const flags = await Flag.find({ sessionId: session._id })
    .sort({ raisedAt: 1 })
    .populate('reviewedBy', 'name email')
    .lean();

  return ok(res, { items: flags });
});

/**
 * PATCH /flags/:id
 * Updates review state, verdict, and note of a flag, emitting flag:updated to proctors.
 */
const patchFlag = asyncHandler(async (req, res) => {
  const flag = await Flag.findById(req.params.id);
  if (!flag) throw new ApiError(404, 'NOT_FOUND', 'Flag not found');

  await ensureExamStaffAccess(flag.examId, req.user);

  const { reviewed, verdict, note } = req.body;

  flag.reviewedBy = req.user.id;
  if (reviewed !== undefined) flag.reviewed = Boolean(reviewed);
  if (verdict !== undefined) {
    flag.verdict = verdict;
    flag.reviewed = true;
  }
  if (note !== undefined) flag.note = String(note).slice(0, 1000);

  await flag.save();

  // Realtime notification to exam proctors
  emitToExam(flag.examId, 'flag:updated', {
    _id: flag._id,
    sessionId: flag.sessionId,
    reviewed: flag.reviewed,
    verdict: flag.verdict,
    note: flag.note,
  });

  return ok(res, flag);
});

/**
 * POST /sessions/:id/signals
 * HTTP fallback for candidates submitting integrity signal batches.
 */
const postSignals = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).lean();
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session not found');

  // Must be candidate's own session
  if (String(session.candidateId) !== String(req.user.id)) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot submit signals for another candidate');
  }

  if (session.status === 'ENDED') {
    throw new ApiError(409, 'CONFLICT', 'Session has already ended');
  }

  const { flags } = await processBatch({
    sessionId: String(session._id),
    examId: String(session.examId),
    candidate: { id: req.user.id, name: req.user.name },
    signals: req.body.signals,
  });

  for (const flag of flags) {
    emitToExam(session.examId, 'flag:new', flag);
  }

  if (flags.length > 0) {
    const rank = { LOW: 1, MED: 2, HIGH: 3 };
    const top = flags.reduce((a, b) => (rank[b.severity] > rank[a.severity] ? b : a));
    emitToExam(session.examId, 'session:status', {
      sessionId: String(session._id),
      status: 'FLAGGED',
      maxSeverity: top.severity,
    });
  }

  return ok(res, { flags: flags.length });
});

module.exports = {
  getSessionFlags,
  patchFlag,
  postSignals,
};
