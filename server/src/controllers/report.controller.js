const Flag = require('../models/Flag');
const Session = require('../models/Session');
const asyncHandler = require('../utils/asyncHandler');
const { loadExamForStaff } = require('../utils/access');
const { ok } = require('../utils/response');

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
});

module.exports = { getExamReport };
