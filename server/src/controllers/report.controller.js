const Flag = require('../models/Flag');
const Session = require('../models/Session');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { loadExamForStaff } = require('../utils/access');
const { ok } = require('../utils/response');

const getExamReport = asyncHandler(async (req, res) => {
  const exam = await loadExamForStaff(req.params.id, req.user);
  const sessionsQuery = Session.find({ examId: exam._id });
  if (req.user.role === 'ADMIN') sessionsQuery.select('candidateId status startedAt endedAt flagCount maxSeverity');
  else sessionsQuery.select('-answers');
  sessionsQuery.populate('candidateId', 'name email').lean();
  const flagsQuery = Flag.find({ examId: exam._id }).sort({ raisedAt: -1 });
  if (req.user.role === 'ADMIN') flagsQuery.select('sessionId code severity score reviewed verdict raisedAt');
  const [sessions, flags, candidates] = await Promise.all([
    sessionsQuery,
    flagsQuery.lean(),
    User.find({ _id: { $in: exam.candidateIds } }).select('name email').sort({ name: 1 }).lean(),
  ]);

  const sessionsById = new Map(sessions.map(session => [String(session._id), session]));
  if (req.query.format === 'csv') {
    const rows = [['candidate_name', 'candidate_email', 'code', 'severity', 'score', 'reviewed', 'verdict', 'raised_at']];
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    for (const flag of flags) {
      const candidate = sessionsById.get(String(flag.sessionId))?.candidateId || {};
      rows.push([candidate.name, candidate.email, flag.code, flag.severity, flag.score, flag.reviewed, flag.verdict, flag.raisedAt?.toISOString?.()]);
    }
    res.type('text/csv').attachment(`${exam.title.replace(/[^a-z0-9-_]+/gi, '-')}-report.csv`)
      .send(rows.map(row => row.map(csvCell).join(',')).join('\r\n'));
    return;
  }
  ok(res, { exam, candidates, sessions, flags });
});

module.exports = { getExamReport };
