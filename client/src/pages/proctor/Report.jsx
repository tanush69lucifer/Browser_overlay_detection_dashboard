import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { downloadExamReport, getExamReport } from '../../api/proctor';
import { useAuth } from '../../store/auth';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import ReviewAnalytics from './ReviewAnalytics';

const severityKeys = { LOW: 'low', MED: 'medium', HIGH: 'high' };

export default function Report() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const homePath = isAdmin ? '/admin' : '/proctor';
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingCandidates, setExportingCandidates] = useState(false);
  const [range, setRange] = useState('all');

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getExamReport(examId, { range });
      setReport(result);
    } catch (err) {
      setError(err?.message || 'Unable to load the exam report');
    } finally {
      setLoading(false);
    }
  }, [examId, range]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const candidateRows = useMemo(() => {
    if (!report) return [];
    const flagsBySession = new Map();
    for (const flag of report.flags || []) {
      const key = String(flag.sessionId);
      const list = flagsBySession.get(key) || [];
      list.push(flag);
      flagsBySession.set(key, list);
    }

    const sessionsByCandidate = new Map();
    for (const session of report.sessions || []) {
      const candidateId = String(session.candidateId?._id || session.candidateId || '');
      sessionsByCandidate.set(candidateId, session);
    }
    const candidatesById = new Map(
      (report.candidates || []).map((candidate) => [String(candidate._id || candidate.id), candidate])
    );
    for (const session of report.sessions || []) {
      const candidate = session.candidateId || {};
      candidatesById.set(String(candidate._id || candidate), candidate);
    }

    return [...candidatesById.entries()].map(([candidateId, candidate]) => {
      const session = sessionsByCandidate.get(candidateId);
      const flags = session ? flagsBySession.get(String(session._id)) || [] : [];
      return {
        id: candidateId,
        sessionId: session?._id || null,
        name: candidate.name || 'Candidate',
        email: candidate.email || '',
        status: session?.status || 'NOT STARTED',
        count: flags.length,
        reviewed: flags.filter((flag) => flag.reviewed).length,
        low: flags.filter((flag) => flag.severity === 'LOW').length,
        medium: flags.filter((flag) => flag.severity === 'MED').length,
        high: flags.filter((flag) => flag.severity === 'HIGH').length,
      };
    });
  }, [report]);

  const chartRows = useMemo(() => {
    const byType = new Map();
    for (const flag of report?.flags || []) {
      const item = byType.get(flag.code) || { type: String(flag.code).replaceAll('_', ' '), low: 0, medium: 0, high: 0 };
      item[severityKeys[flag.severity] || 'low'] += 1;
      byType.set(flag.code, item);
    }
    return [...byType.values()];
  }, [report]);

  const reviewStats = useMemo(() => {
    const reviewed = (report?.flags || []).filter((flag) => flag.reviewed);
    return {
      total: report?.flags?.length || 0,
      reviewed: reviewed.length,
      coverage: report?.flags?.length ? Math.round((reviewed.length / report.flags.length) * 100) : 0,
    };
  }, [report]);

  const exportCsv = async () => {
    try {
      setExporting(true);
      const blob = await downloadExamReport(examId, { range });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(report?.exam?.title || 'exam').replace(/[^a-z0-9-_]+/gi, '-')}-report.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Unable to export the report');
    } finally {
      setExporting(false);
    }
  };

  const exportCandidateCsv = () => {
    try {
      setExportingCandidates(true);
      const cell = (value) => {
        const text = String(value ?? '');
        const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const rows = [
        ['candidate_name', 'candidate_email', 'session_status', 'flags', 'low', 'medium', 'high', 'reviewed', 'range'],
        ...candidateRows.map((candidate) => [
          candidate.name,
          candidate.email,
          candidate.status,
          candidate.count,
          candidate.low,
          candidate.medium,
          candidate.high,
          `${candidate.reviewed}/${candidate.count}`,
          range,
        ]),
      ];
      const blob = new Blob([rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(report?.exam?.title || 'exam').replace(/[^a-z0-9-_]+/gi, '-')}-candidates.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Unable to export candidate summaries');
    } finally {
      setExportingCandidates(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div>;
  }
  if (error && !report) return <ErrorState message={error} onRetry={loadReport} />;
  if (!report) return <EmptyState title="Report unavailable" hint="The report could not be loaded." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => navigate(isAdmin ? homePath : `/proctor/exam/${examId}`)}>
            ← {isAdmin ? 'Exams' : 'Live console'}
          </button>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">Exam report</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{report.exam?.title || 'Exam'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-print-hide variant="ghost" loading={exportingCandidates} onClick={exportCandidateCsv}>Export candidates CSV</Button>
          <Button data-print-hide loading={exporting} onClick={exportCsv}>Export flags CSV</Button>
          <Button data-print-hide variant="ghost" onClick={() => window.print()}>Print / Save PDF</Button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={loadReport} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-slate-400">Candidates</p><p className="num mt-2 text-2xl font-semibold text-white">{candidateRows.length}</p></Card>
        <Card><p className="text-sm text-slate-400">Flags for review</p><p className="num mt-2 text-2xl font-semibold text-white">{reviewStats.total}</p></Card>
        <Card>
          <p className="text-sm text-slate-400">Flag review coverage</p>
          <p className="num mt-2 text-2xl font-semibold text-white">{reviewStats.coverage}%</p>
          <p className="mt-1 text-xs text-slate-400">{reviewStats.reviewed} of {reviewStats.total} flags marked reviewed in this range.</p>
        </Card>
      </div>

      <ReviewAnalytics
        analytics={report.analytics}
        flags={report.flags || []}
        range={range}
        onRangeChange={setRange}
      />

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Raised flags by signal type and severity</h2>
          <p className="mt-1 text-sm text-slate-400">This chart counts persisted review flags; detector-signal counts are shown above.</p>
        </div>
        {chartRows.length ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="type" angle={-15} textAnchor="end" interval={0} height={60} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                <Bar dataKey="low" name="Low" stackId="severity" fill="#22c55e" />
                <Bar dataKey="medium" name="Medium" stackId="severity" fill="#f59e0b" />
                <Bar dataKey="high" name="High" stackId="severity" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState title="No flags to chart" hint="Flags will appear here after scoring raises them for review." />}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-white">Per-candidate summary</h2>
        </div>
        {candidateRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Candidate</th>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                  <th className="px-4 py-3 font-medium">Low / Medium / High</th>
                  <th className="px-4 py-3 font-medium">Reviewed</th>
                  {!isAdmin ? <th className="px-4 py-3 font-medium">Review</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {candidateRows.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="px-4 py-3"><div className="font-medium text-white">{candidate.name}</div><div className="text-xs text-slate-400">{candidate.email}</div></td>
                    <td className="px-4 py-3"><Badge tone={candidate.status === 'ONLINE' ? 'OK' : 'NEUTRAL'}>{candidate.status}</Badge></td>
                    <td className="num px-4 py-3">{candidate.count}</td>
                    <td className="num px-4 py-3">{candidate.low} / {candidate.medium} / {candidate.high}</td>
                    <td className="num px-4 py-3">{candidate.reviewed} / {candidate.count}</td>
                    {!isAdmin ? (
                      <td className="px-4 py-3">
                        <Button variant="ghost" disabled={!candidate.sessionId} onClick={() => navigate(`/proctor/session/${candidate.sessionId}`)}>
                          {candidate.sessionId ? 'Review session' : 'Not started'}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-4"><EmptyState title="No candidate sessions" hint="Candidate summaries appear after an exam session starts." /></div>}
      </Card>
    </div>
  );
}
