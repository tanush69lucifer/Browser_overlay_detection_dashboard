import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyExams } from '../../api/proctor';
import { 
  ShieldCheck, 
  Radio, 
  Clock, 
  Calendar, 
  Users, 
  AlertTriangle, 
  ChevronRight, 
  FileSpreadsheet, 
  Search,
  ExternalLink
} from 'lucide-react';

export default function ProctorHome() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchExams = async () => {
      try {
        setLoading(true);
        const data = await getMyExams();
        if (mounted) {
          setExams(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to load exams:', err);
          setError('Unable to load assigned exams. Please verify your connection.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchExams();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredExams = exams.filter((exam) => {
    const matchesStatus = statusFilter === 'ALL' || exam.status?.toUpperCase() === statusFilter;
    const matchesSearch = 
      exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-[#1e293b] bg-[#111827]/80 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white tracking-tight">Proctor Command Center</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Active Duty
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Browser Overlay & Integrity Telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-2 text-slate-400 bg-[#0f172a] px-3 py-1.5 rounded-md border border-[#1e293b]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Proctor: <strong className="text-slate-200">Tanya Goyal</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Welcome & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Assigned Exam Sessions</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select an ongoing session to enter the live proctoring console or review completed reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exams..."
                className="bg-[#111827] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
              />
            </div>

            {/* Filter Pills */}
            <div className="bg-[#111827] p-1 rounded-lg border border-[#1e293b] flex gap-1 text-xs">
              {['ALL', 'LIVE', 'UPCOMING', 'ENDED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-md transition font-medium ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-lg text-xs flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => window.location.reload()} 
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-[#111827] border border-[#1e293b] rounded-xl animate-pulse p-6 space-y-4">
                <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                <div className="h-6 bg-slate-800 rounded w-3/4"></div>
                <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                <div className="h-10 bg-slate-800 rounded w-full mt-6"></div>
              </div>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 bg-[#111827]/40 border border-[#1e293b] rounded-xl p-8">
            <Radio className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No exams match your criteria</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Check back closer to your scheduled duty window or clear search filters.
            </p>
          </div>
        ) : (
          /* Exam Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredExams.map((exam) => {
              const isLive = exam.status?.toUpperCase() === 'LIVE';
              const isUpcoming = exam.status?.toUpperCase() === 'UPCOMING';
              const isEnded = exam.status?.toUpperCase() === 'ENDED';

              return (
                <div
                  key={exam.id}
                  className="bg-[#111827] border border-[#1e293b] hover:border-slate-600 rounded-xl p-5 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-black/40 group"
                >
                  <div className="space-y-3">
                    {/* Header Chips */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400 bg-[#0f172a] px-2 py-0.5 rounded border border-[#1e293b]">
                        {exam.id}
                      </span>
                      {isLive && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          LIVE NOW
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          <Clock className="w-3 h-3" />
                          UPCOMING
                        </span>
                      )}
                      {isEnded && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30">
                          ENDED
                        </span>
                      )}
                    </div>

                    {/* Title & Window */}
                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {exam.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{exam.window || 'Scheduled window'}</span>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e293b]/60">
                      <div className="bg-[#0b0f17] p-2 rounded-lg border border-[#1e293b]/60 text-center">
                        <span className="text-[10px] text-slate-500 block">Total</span>
                        <span className="num text-sm font-semibold text-slate-200">
                          {exam.candidateCount ?? 0}
                        </span>
                      </div>
                      <div className="bg-[#0b0f17] p-2 rounded-lg border border-[#1e293b]/60 text-center">
                        <span className="text-[10px] text-slate-500 block">Online</span>
                        <span className="num text-sm font-semibold text-emerald-400">
                          {exam.onlineCount ?? 0}
                        </span>
                      </div>
                      <div className="bg-[#0b0f17] p-2 rounded-lg border border-[#1e293b]/60 text-center">
                        <span className="text-[10px] text-slate-500 block">Flagged</span>
                        <span className="num text-sm font-semibold text-rose-400">
                          {exam.flaggedCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-5 flex items-center gap-2">
                    <Link
                      to={`/proctor/console/${exam.id}`}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                        isLive
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-[#1e293b]'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Open Console</span>
                    </Link>

                    <Link
                      to={`/proctor/report/${exam.id}`}
                      title="View Integrity Report"
                      className="p-2 rounded-lg bg-[#0b0f17] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#1e293b] transition"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
