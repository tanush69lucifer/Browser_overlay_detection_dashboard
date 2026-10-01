// Controller for exam integrity reporting with JSON aggregation and CSV download.

const Exam = require('../models/Exam');
const Session = require('../models/Session');
const Flag = require('../models/Flag');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

/**
 * Escapes values for safe CSV generation, quoting strings that contain commas, quotes, or newlines.
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /exams/:id/report?format=json|csv
 * Generates an aggregated integrity report per candidate and for the whole exam.
 */
const getExamReport = asyncHandler(async (req, res) => {
  const examId = req.params.id;

  const exam = await Exam.findById(examId)
    .select('title startAt endAt sensitivity proctorIds')
    .lean();

  if (!exam) {
    throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
  }

  // Authorization: Admins have full access; proctors must be assigned to the exam
  if (req.user.role === 'PROCTOR') {
    const isAssigned = exam.proctorIds?.some((id) => String(id) === String(req.user.id));
    if (!isAssigned) {
      throw new ApiError(403, 'FORBIDDEN', 'You are not assigned to proctor this exam');
    }
  } else if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }

  const [sessions, flags] = await Promise.all([
    Session.find({ examId: exam._id })
      .populate('candidateId', 'name email')
      .lean(),
    Flag.find({ examId: exam._id }).lean(),
  ]);

  // Aggregate totals
  const totals = {
    sessions: sessions.length,
    flagged: 0,
    bySeverity: { LOW: 0, MED: 0, HIGH: 0 },
    byCode: {},
  };

  for (const flag of flags) {
    if (flag.severity && totals.bySeverity[flag.severity] !== undefined) {
      totals.bySeverity[flag.severity] += 1;
    }
    if (flag.code) {
      totals.byCode[flag.code] = (totals.byCode[flag.code] || 0) + 1;
    }
  }

  // Aggregate candidate rows
  const candidates = sessions.map((session) => {
    const cand = session.candidateId || {};
    const candId = String(cand._id || session.candidateId || '');
    const candFlags = flags.filter(
      (f) => String(f.candidateId) === candId || String(f.sessionId) === String(session._id)
    );

    const reviewedCount = candFlags.filter((f) => f.reviewed).length;
    let lastFlagAt = null;
    if (candFlags.length > 0) {
      const sorted = [...candFlags].sort(
        (a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime()
      );
      lastFlagAt = sorted[0].raisedAt;
    }

    const flagCount = Math.max(session.flagCount || 0, candFlags.length);

    return {
      candidateId: candId,
      name: cand.name || 'Unknown',
      email: cand.email || '',
      status: session.status || 'ONLINE',
      flagCount,
      maxSeverity: session.maxSeverity || 'NONE',
      reviewedCount,
      lastFlagAt,
    };
  });

  totals.flagged = candidates.filter((c) => c.flagCount > 0).length;

  const format = (req.query.format || 'json').toLowerCase();

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=integrity-report-${exam._id}.csv`
    );

    const csvHeaders = [
      'Candidate Name',
      'Email',
      'Status',
      'Flags',
      'Max Severity',
      'Reviewed Flags',
      'Last Flag Raised At',
    ];

    const rows = candidates.map((c) => [
      escapeCsv(c.name),
      escapeCsv(c.email),
      escapeCsv(c.status),
      c.flagCount,
      escapeCsv(c.maxSeverity),
      c.reviewedCount,
      c.lastFlagAt ? new Date(c.lastFlagAt).toISOString() : '',
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return res.status(200).send(csvContent);
  }

  return ok(res, {
    exam: {
      _id: exam._id,
      title: exam.title,
      startAt: exam.startAt,
      endAt: exam.endAt,
      sensitivity: exam.sensitivity,
    },
    totals,
    candidates,
  });
});

module.exports = {
  getExamReport,
};
