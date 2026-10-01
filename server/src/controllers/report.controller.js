const Flag = require('../models/Flag');
const Session = require('../models/Session');
const User = require('../models/User');
const DetectorSignal = require('../models/DetectorSignal');
const asyncHandler = require('../utils/asyncHandler');
const { loadExamForStaff } = require('../utils/access');
const { ok } = require('../utils/response');

const RANGE_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function getRangeMatch(examId, range, now = new Date()) {
  const match = { examId };
  if (RANGE_MS[range]) match.occurredAt = { $gte: new Date(now.getTime() - RANGE_MS[range]), $lte: now };
  return match;
}

function getTrendUnit(range) {
  if (range === '24h') return 'hour';
  if (range === 'all') return 'month';
  return 'day';
}

async function getSignalAnalytics(examId, range) {
  const match = getRangeMatch(examId, range);
  const trendUnit = getTrendUnit(range);
  const [byTypeAndTool, trend, total] = await Promise.all([
    DetectorSignal.aggregate([
      { $match: match },
      {
        $group: {
          _id: { type: '$code', tool: { $ifNull: ['$meta.tool', '$code'] } },
          count: { $sum: 1 },
          low: { $sum: { $cond: [{ $eq: ['$severity', 'LOW'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$severity', 'MED'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] } },
          firstSeen: { $min: '$occurredAt' },
          lastSeen: { $max: '$occurredAt' },
        },
      },
      {
        $project: {
          _id: 0,
          type: '$_id.type',
          tool: '$_id.tool',
          count: 1,
          low: 1,
          medium: 1,
          high: 1,
          firstSeen: 1,
          lastSeen: 1,
        },
      },
      { $sort: { count: -1, type: 1, tool: 1 } },
    ]),
    DetectorSignal.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            bucket: { $dateTrunc: { date: '$occurredAt', unit: trendUnit, timezone: 'UTC' } },
            type: '$code',
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, bucket: '$_id.bucket', type: '$_id.type', count: 1 } },
      { $sort: { bucket: 1, type: 1 } },
    ]),
    DetectorSignal.countDocuments(match),
  ]);

  return { range, trendUnit, total, byTypeAndTool, trend };
}

const getExamReport = asyncHandler(async (req, res) => {
  const exam = await loadExamForStaff(req.params.id, req.user);
  const range = req.query.range || 'all';
  const cutoff = RANGE_MS[range] ? new Date(Date.now() - RANGE_MS[range]) : null;
  const sessionsQuery = Session.find({ examId: exam._id });
  if (req.user.role === 'ADMIN') sessionsQuery.select('candidateId status startedAt endedAt flagCount maxSeverity');
  else sessionsQuery.select('-answers');
  sessionsQuery.populate('candidateId', 'name email').lean();
  const flagFilter = { examId: exam._id, ...(cutoff ? { raisedAt: { $gte: cutoff, $lte: new Date() } } : {}) };
  const flagsQuery = Flag.find(flagFilter).sort({ raisedAt: -1 });
  if (req.user.role === 'ADMIN') flagsQuery.select('sessionId code severity score reviewed verdict raisedAt');
  const [sessions, flags, candidates, analytics] = await Promise.all([
    sessionsQuery,
    flagsQuery.lean(),
    User.find({ _id: { $in: exam.candidateIds } }).select('name email').sort({ name: 1 }).lean(),
    req.query.format === 'csv' ? Promise.resolve(null) : getSignalAnalytics(exam._id, range),
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
  ok(res, { exam, candidates, sessions, flags, analytics });
});

module.exports = { getExamReport };
