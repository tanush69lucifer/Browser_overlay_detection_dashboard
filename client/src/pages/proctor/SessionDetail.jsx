import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSession, getSessionFlags, updateFlag } from '../../api/proctor';
import { createSocket } from '../../realtime/socket';
import FlagTimeline from '../../components/proctor/FlagTimeline';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Clock, 
  Monitor, 
  ShieldAlert, 
  CheckCircle2, 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Loader2,
  BellRing
} from 'lucide-react';

export default function SessionDetail() {
  const { id: sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // In-app toast notification state for optimistic updates
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [sessionData, flagsData] = await Promise.all([
          getSession(sessionId),
          getSessionFlags(sessionId),
        ]);

        if (!mounted) return;
        setSession(sessionData);
        setFlags(Array.isArray(flagsData) ? flagsData : []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load candidate session details:', err);
        setError('Failed to load candidate session details.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    // Live socket subscription to flag:new for this candidate's session
    const socket = createSocket();
    socket.on('flag:new', (newFlag) => {
      if (!mounted) return;
      if (newFlag.sessionId === sessionId) {
        setFlags((prev) => [newFlag, ...prev]);
        showToast(`New flag reported: ${newFlag.plainCode || newFlag.code}`, 'warning');
      }
    });

    return () => {
      mounted = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      socket.disconnect();
    };
  }, [sessionId]);

  // Handle flag update with optimistic UI update + toast notification
  const handleUpdateFlag = async (flagId, updates) => {
    // 1. Optimistic local update
    const previousFlags = [...flags];
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, ...updates } : f))
    );

    showToast(
      updates.verdict 
        ? `Verdict recorded: ${updates.verdict}` 
        : 'Flag marked as reviewed',
      'success'
    );

    // 2. Perform backend API request
    try {
      await updateFlag(flagId, updates);
    } catch (err) {
      console.error('Failed to save flag update:', err);
      // Rollback on network failure
      setFlags(previousFlags);
      showToast('Failed to update flag. Rolling back change.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs text-slate-400">Loading candidate audit timeline...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-[#111827] border border-rose-500/30 p-6 rounded-xl max-w-md w-full text-center space-y-4">
          <p className="text-sm text-rose-300">{error || 'Session not found'}</p>
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

  const isOnline = session.status === 'Online';
  const isHigh = session.maxSeverity === 'HIGH';
  const isMed = session.maxSeverity === 'MED' || session.maxSeverity === 'MEDIUM';

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
      {/* Toast Notification Container */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-950 border-rose-500/50 text-rose-200'
              : toast.type === 'warning'
              ? 'bg-amber-950 border-amber-500/50 text-amber-200'
              : 'bg-emerald-950 border-emerald-500/50 text-emerald-200'
          }`}
        >
          <BellRing className="w-4 h-4 flex-shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Navigation */}
      <header className="border-b border-[#1e293b] bg-[#111827]/90 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-1.5 rounded-lg bg-[#0b0f17] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e293b] transition"
            title="Return to console"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Candidate Integrity Drill-Down</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {session.candidateId || session.id}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Session Telemetry & Evidence Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            ></span>
            <span>{session.status || 'Offline'}</span>
          </span>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Neutral Proctor Notice per SPEC: Never 'cheater', strictly 'flagged for review' */}
        <div className="bg-[#111827] border border-amber-500/30 p-4 rounded-xl flex items-start gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h3 className="font-semibold text-amber-200">Candidate Session Flagged for Review</h3>
            <p className="text-slate-400 leading-relaxed">
              Automated sensors captured anomalous overlay or window blur activity. As proctor, 
              examine the timestamped evidence signals below and register your neutral verdict.
            </p>
          </div>
        </div>

        {/* Candidate Profile Details Card */}
        <section className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>{session.name}</span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{session.email}</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3">
              <div className="bg-[#0b0f17] px-3 py-2 rounded-lg border border-[#1e293b] text-center">
                <span className="text-[10px] text-slate-500 block uppercase">Max Severity</span>
                <span
                  className={`text-xs font-bold ${
                    isHigh
                      ? 'text-rose-400'
                      : isMed
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  {session.maxSeverity || 'NONE'}
                </span>
              </div>

              <div className="bg-[#0b0f17] px-3 py-2 rounded-lg border border-[#1e293b] text-center">
                <span className="text-[10px] text-slate-500 block uppercase">Recorded Flags</span>
                <span className="num text-xs font-bold text-rose-400">
                  {flags.length}
                </span>
              </div>
            </div>
          </div>

          {/* Technical Metadata Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2 bg-[#0b0f17] p-3 rounded-lg border border-[#1e293b]/70">
              <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <span className="text-[11px] text-slate-500 block">Session Started</span>
                <span className="text-slate-200 font-medium">
                  {session.startedAt || '10:00 AM (Scheduled)'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-[#0b0f17] p-3 rounded-lg border border-[#1e293b]/70">
              <Monitor className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block">Reported User Agent</span>
                <span className="text-slate-300 font-mono text-[11px] truncate block" title={session.userAgent}>
                  {session.userAgent || 'Chrome 128 / Windows 10 x64'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Flag Timeline Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Anomalies & Evidence Timeline ({flags.length})
            </h3>
            <span className="text-xs text-slate-400">
              Sorted chronologically
            </span>
          </div>

          <FlagTimeline flags={flags} onUpdateFlag={handleUpdateFlag} />
        </section>
      </main>
    </div>
  );
}
