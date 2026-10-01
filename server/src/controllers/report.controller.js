const Flag = require('../models/Flag');
const Session = require('../models/Session');
<<<<<<< HEAD
=======
const User = require('../models/User');
>>>>>>> origin/main
const asyncHandler = require('../utils/asyncHandler');
const { loadExamForStaff } = require('../utils/access');
const { ok } = require('../utils/response');

<<<<<<< HEAD
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

const getExamReport = asyncHandler(async (req, res) => {
  const exam = await loadExamForStaff(req.params.id, req.user);
  const [sessions, flags] = await Promise.all([
    Session.find({ examId: exam._id }).select('-answers').populate('candidateId', 'name email').sort({ startedAt: 1 }).lean(),
    Flag.find({ examId: exam._id }).sort({ raisedAt: -1 }).lean(),
  ]);

  if (req.query.format === 'csv') {
    const header = ['candidateName', 'candidateEmail', 'sessionStatus', 'flagCount', 'maxSeverity', 'flagCode', 'flagSeverity', 'score', 'raisedAt'];
    const rows = flags.map(flag => {
      const session = sessions.find(item => String(item._id) === String(flag.sessionId));
      const values = [session?.candidateId?.name, session?.candidateId?.email, session?.status, session?.flagCount, session?.maxSeverity, flag.code, flag.severity, flag.score, flag.raisedAt?.toISOString?.()];
      return values.map(csvCell).join(',');
    });
    res.type('text/csv').attachment(`exam-${exam._id}-report.csv`).send([header.join(','), ...rows].join('\r\n'));
    return;
  }

  ok(res, {
    report: {
      exam: { _id: exam._id, title: exam.title, startAt: exam.startAt, endAt: exam.endAt },
      sessions: sessions.map(session => ({ ...session, candidate: session.candidateId })),
      flags,
      totals: {
        sessions: sessions.length,
        online: sessions.filter(session => session.status === 'ONLINE').length,
        flags: flags.length,
        bySeverity: Object.fromEntries(['LOW', 'MED', 'HIGH'].map(severity => [severity, flags.filter(flag => flag.severity === severity).length])),
      },
    },
  });
=======
const getExamReport = asyncHandler(async (req, res) => {
  const exam = await loadExamForStaff(req.params.id, req.user);
  const sessionsQuery = Session.find({ examId: exam._id });
  if (req.user.role === 'ADMIN') {
    sessionsQuery.select('candidateId status startedAt endedAt flagCount maxSeverity');
  } else {
    sessionsQuery.select('-answers');
  }
  sessionsQuery.populate('candidateId', 'name email').lean();
  const flagsQuery = Flag.find({ examId: exam._id }).sort({ raisedAt: -1 });
  if (req.user.role === 'ADMIN') {
    flagsQuery.select('sessionId code severity score reviewed verdict raisedAt');
  }
  const [sessions, flags, candidates] = await Promise.all([
    sessionsQuery,
    flagsQuery.lean(),
    User.find({ _id: { $in: exam.candidateIds } }).select('name email').sort({ name: 1 }).lean(),
  ]);
  const sessionsById = new Map(sessions.map((session) => [String(session._id), session]));
  if (req.query.format === 'csv') {
    const rows = [['candidate_name', 'candidate_email', 'code', 'severity', 'score', 'reviewed', 'verdict', 'raised_at']];
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    for (const flag of flags) {
      const session = sessionsById.get(String(flag.sessionId));
      const candidate = session?.candidateId || {};
      rows.push([
        candidate.name,
        candidate.email,
        flag.code,
        flag.severity,
        flag.score,
        flag.reviewed,
        flag.verdict,
        flag.raisedAt?.toISOString?.(),
      ]);
    }
    res.type('text/csv').attachment(`${exam.title.replace(/[^a-z0-9-_]+/gi, '-')}-report.csv`)
      .send(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
    return;
  }
  ok(res, { exam, candidates, sessions, flags });
>>>>>>> origin/main
});

module.exports = { getExamReport };
