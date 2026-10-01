const Exam = require('../models/Exam');
const User = require('../models/User');
const Session = require('../models/Session');
const Fingerprint = require('../models/Fingerprint');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { loadExamForStaff } = require('../utils/access');
const { ok, paginate } = require('../utils/response');
const counters = require('../redis/counters');

const unique = (ids = []) => [...new Set(ids.map(String))];

// Every assigned id must be an active user with an allowed role.
async function assertRoles(ids, roles, label) {
  if (!ids.length) return;
  const count = await User.countDocuments({ _id: { $in: ids }, role: { $in: roles }, isActive: true });
  if (count !== ids.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Some selected ${label} are invalid or inactive`);
  }
}

async function assertFingerprints(ids) {
  if (!ids.length) return;
  const count = await Fingerprint.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some selected fingerprints are unavailable');
  }
}

const createExam = asyncHandler(async (req, res) => {
  const body = {
    ...req.body,
    candidateIds: unique(req.body.candidateIds),
    proctorIds: unique(req.body.proctorIds),
    fingerprintIds: unique(req.body.fingerprintIds),
  };
  await assertRoles(body.candidateIds, ['CANDIDATE'], 'candidates');
  await assertRoles(body.proctorIds, ['PROCTOR', 'ADMIN'], 'proctors');
  await assertFingerprints(body.fingerprintIds);
  const exam = await Exam.create({ ...body, createdBy: req.user.id });
  ok(res, { exam }, { status: 201, message: 'Exam created' });
});

// Role-scoped list: admin = all, proctor = assigned, candidate = assigned (no questions).
const listExams = asyncHandler(async (req, res) => {
  const { page, limit, search, sort } = req.query;
  const { role, id: userId } = req.user;

  const filter = {};
  if (role === 'PROCTOR') filter.proctorIds = userId;
  if (role === 'CANDIDATE') filter.candidateIds = userId;
  if (search) filter.title = new RegExp(escapeRegex(search), 'i');

  const projection =
    role === 'CANDIDATE' ? 'title description startAt endAt durationMin' : '-questions';

  const examsQuery = Exam.find(filter)
    .select(projection)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (role === 'ADMIN') examsQuery.populate('proctorIds', 'name email');

  const [docs, total] = await Promise.all([
    examsQuery.lean(),
    Exam.countDocuments(filter),
  ]);

  let items;
  if (role === 'CANDIDATE') {
    // Attach the candidate's own session status so the UI can show "Submitted" / "Resume".
    const sessions = await Session.find({ candidateId: userId, examId: { $in: docs.map((d) => d._id) } })
      .select('examId status')
      .lean();
    const statusByExam = new Map(sessions.map((s) => [String(s.examId), s.status]));
    items = docs.map((d) => ({ ...d, mySessionStatus: statusByExam.get(String(d._id)) || null }));
  } else {
    items = docs.map(({ candidateIds = [], proctorIds = [], ...rest }) => ({
      ...rest,
      candidateCount: candidateIds.length,
      proctorCount: proctorIds.length,
      ...(role === 'ADMIN'
        ? {
            proctors: proctorIds.filter(Boolean).map(({ _id, name, email: proctorEmail }) => ({
              id: String(_id),
              name,
              email: proctorEmail,
            })),
          }
        : {}),
    }));
  }

  ok(res, paginate(items, total, page, limit));
});

const getExam = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;

  if (role === 'CANDIDATE') {
    const exam = await Exam.findById(req.params.id)
      .select('title description startAt endAt durationMin questions candidateIds fingerprintIds')
      .lean();
    if (!exam || !exam.candidateIds.some((id) => String(id) === userId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
    }
    const { candidateIds, fingerprintIds, ...safe } = exam;
    const fingerprints = await Fingerprint.find({ isActive: true }).sort({ tool: 1 }).lean();
    return ok(res, { exam: { ...safe, fingerprints } });
  }

  const exam = await loadExamForStaff(req.params.id, req.user);
  const people = await User.find({ _id: { $in: [...exam.candidateIds, ...exam.proctorIds] } })
    .select('name email role')
    .lean();
  const byId = new Map(people.map((p) => [String(p._id), p]));
  const pick = (ids) => ids.map((id) => byId.get(String(id))).filter(Boolean);

  ok(res, {
    exam: {
      ...exam,
      candidates: pick(exam.candidateIds),
      proctors: pick(exam.proctorIds),
      summary: await counters.getSummary(String(exam._id)),
    },
  });
});

const updateExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'NOT_FOUND', 'Exam not found');

  const updates = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined));
  if (updates.candidateIds) {
    updates.candidateIds = unique(updates.candidateIds);
    await assertRoles(updates.candidateIds, ['CANDIDATE'], 'candidates');
  }
  if (updates.proctorIds) {
    updates.proctorIds = unique(updates.proctorIds);
    await assertRoles(updates.proctorIds, ['PROCTOR', 'ADMIN'], 'proctors');
  }
  if (updates.fingerprintIds) {
    updates.fingerprintIds = unique(updates.fingerprintIds);
    await assertFingerprints(updates.fingerprintIds);
  }

  exam.set(updates);
  if (exam.endAt <= exam.startAt) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'End time must be after start time', [
      { path: 'endAt', message: 'End time must be after start time' },
    ]);
  }
  await exam.save();
  ok(res, { exam }, { message: 'Exam updated' });
});

module.exports = { createExam, listExams, getExam, updateExam };
