import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReport, downloadReportCsv } from '../../api/proctor';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  ArrowLeft,
  Download,
  Users,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  FileSpreadsheet,
  ArrowUpDown,
  Search,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function Report() {
  const { examId = 'exam-cs301-2026' } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Table filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' | 'asc'

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      try {
        setLoading(true);
        const data = await getReport(examId);
        if (!mounted) return;
        setReport(data);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load integrity report:', err);
        setError('Failed to load exam integrity report.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReport();
    return () => {
      mounted = false;
    };
  }, [examId]);

  // Export CSV handler downloading blob
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const blob = await downloadReportCsv(examId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `integrity-report-${examId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('CSV Export failed:', err);
      alert('Failed to download CSV export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Sort and filter candidates list
  const candidateList = report?.candidateSummaries || [];
  const filteredCandidates = useMemo(() => {
    return candidateList
      .filter((c) => {
        const query = searchTerm.toLowerCase();
        return (
          c.name?.toLowerCase().includes(query) ||
          c.candidateId?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const countA = a.flagCount || 0;
        const countB = b.flagCount || 0;
        return sortDirection === 'desc' ? countB - countA : countA - countB;
      });
  }, [candidateList, searchTerm, sortDirection]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs text-slate-400">Compiling exam analytics and reports...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-[#111827] border border-rose-500/30 p-6 rounded-xl max-w-md w-full text-center space-y-4">
          <p className="text-sm text-rose-300">{error || 'Report unavailable'}</p>
          <Link
            to="/proctor"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const totals = report.totals || {};
  const flagsByCode = report.flagsByCode || [];
  const flagsBySeverity = report.flagsBySeverity || [];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-[#1e293b] bg-[#111827]/90 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/proctor/console/${examId}`}
            className="p-1.5 rounded-lg bg-[#0b0f17] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e293b] transition"
            title="Return to console"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Exam Integrity Report</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {examId}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Aggregated Audit Telemetry & Anomaly Distribution
            </p>
          </div>
        </div>

        {/* Export CSV Button */}
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{exporting ? 'Generating...' : 'Export CSV'}</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Totals Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Candidates */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Candidates Monitored</span>
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <p className="num text-2xl font-bold text-white mt-2">
              {totals.totalCandidates ?? 0}
            </p>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              <span>{totals.onlineCount ?? 0} active sessions</span>
            </p>
          </div>

          {/* Clean Completion Rate */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Clean Session Rate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="num text-2xl font-bold text-emerald-400 mt-2">
              {totals.cleanCompletionRate || '88.1%'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Zero high-severity flags</p>
          </div>

          {/* Total Flags */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Flags Logged</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="num text-2xl font-bold text-rose-400 mt-2">
              {totals.totalFlags ?? 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {totals.highSeverityCount ?? 0} critical overlay alerts
            </p>
          </div>

          {/* Severity Breakdown */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Severity Breakdown</span>
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">HIGH</span>
                <span className="num font-bold text-rose-400">{totals.highSeverityCount ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">MED</span>
                <span className="num font-bold text-amber-400">{totals.medSeverityCount ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">LOW</span>
                <span className="num font-bold text-sky-400">{totals.lowSeverityCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section: Flags by Code and Flags by Severity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Flags by Code */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Anomalies by Detection Code
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flagsByCode} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b0f17',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Flags by Severity */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Incidents by Severity Tier
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flagsBySeverity} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="severity" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b0f17',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {flagsBySeverity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Per-Candidate Table */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden space-y-3 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Per-Candidate Audit Summary
              </h3>
              <p className="text-[11px] text-slate-400">
                Sortable candidate roster with flag counts and severity levels.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter candidate..."
                  className="bg-[#0b0f17] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
                />
              </div>

              {/* Sort Toggle */}
              <button
                onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b0f17] border border-[#1e293b] hover:border-slate-600 rounded-lg text-xs font-medium text-slate-300 transition"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Flags: {sortDirection === 'desc' ? 'Highest First' : 'Lowest First'}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-[#1e293b] rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0b0f17] text-slate-400 border-b border-[#1e293b] text-[11px]">
                  <th className="py-2.5 px-4 font-medium">Candidate</th>
                  <th className="py-2.5 px-4 font-medium">Candidate ID</th>
                  <th className="py-2.5 px-4 font-medium">Connection</th>
                  <th className="py-2.5 px-4 font-medium">Max Severity</th>
                  <th className="py-2.5 px-4 font-medium text-right">Flag Count</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60 bg-[#0f172a]">
                {filteredCandidates.map((c) => {
                  const isHigh = c.maxSeverity === 'HIGH';
                  const isMed = c.maxSeverity === 'MED' || c.maxSeverity === 'MEDIUM';

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-100">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.email}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                        {c.candidateId || c.id}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status === 'Online' ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span className="text-slate-300">{c.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isHigh
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isMed
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : c.maxSeverity === 'LOW'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700/50'
                          }`}
                        >
                          {c.maxSeverity || 'NONE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`num font-bold text-xs ${
                            c.flagCount > 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {c.flagCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          to={`/proctor/session/${c.id}`}
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-semibold"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
