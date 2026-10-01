import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import useLiveStore from '../../store/live';
import { getExam, getExamSessions } from '../../api/proctor';
import { createSocket } from '../../realtime/socket';
import ExamHeader from '../../components/proctor/ExamHeader';
import SessionGrid from '../../components/proctor/SessionGrid';
import FlagFeed from '../../components/proctor/FlagFeed';
import { Loader2 } from 'lucide-react';

export default function Console() {
  const { examId = 'exam-cs301-2026' } = useParams();

  const setExam = useLiveStore((state) => state.setExam);
  const loadSessions = useLiveStore((state) => state.loadSessions);
  const applyStatus = useLiveStore((state) => state.applyStatus);
  const applyFlag = useLiveStore((state) => state.applyFlag);
  const applyFlagUpdate = useLiveStore((state) => state.applyFlagUpdate);
  const setSummary = useLiveStore((state) => state.setSummary);
  const setSocketConnected = useLiveStore((state) => state.setSocketConnected);
  const reset = useLiveStore((state) => state.reset);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const socketRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounced refetch (2 seconds) triggered when applyStatus returns false for unknown sessionId
  const triggerDebouncedRefetch = () => {
    if (debounceTimerRef.current) return;
    console.warn('[Console] Unknown candidate session received. Debouncing 2s refetch...');
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const freshSessions = await getExamSessions(examId, { limit: 500 });
        loadSessions(freshSessions);
      } catch (err) {
        console.error('[Console] Debounced refetch failed:', err);
      } finally {
        debounceTimerRef.current = null;
      }
    }, 2000);
  };

  useEffect(() => {
    let isMounted = true;

    async function initConsole() {
      try {
        setLoading(true);
        // Load exam metadata and initial batch of candidate sessions
        const [examData, sessionsData] = await Promise.all([
          getExam(examId),
          getExamSessions(examId, { limit: 500 }),
        ]);

        if (!isMounted) return;

        setExam(examData);
        loadSessions(sessionsData);
        setLoadError(null);
      } catch (err) {
        if (!isMounted) return;
        console.error('[Console] Failed initial data load:', err);
        setLoadError('Failed to load exam sessions. Please check server status.');
      } finally {
        if (isMounted) setLoading(false);
      }

      // Initialize real-time socket per SPEC
      const socket = createSocket();
      socketRef.current = socket;

      // Handle socket connect & room join with ack summary
      socket.on('connect', () => {
        if (!isMounted) return;
        setSocketConnected(true);
        console.log(`[Socket] Connected. Joining exam room: ${examId}`);

        socket.emit('proctor:join', { examId }, (ack) => {
          if (ack?.summary) {
            setSummary(ack.summary);
          }
        });
      });

      socket.on('disconnect', () => {
        if (!isMounted) return;
        setSocketConnected(false);
        console.log('[Socket] Disconnected from proctor room.');
      });

      // Event subscriptions
      socket.on('flag:new', (flag) => {
        if (!isMounted) return;
        applyFlag(flag);
      });

      socket.on('flag:updated', (flag) => {
        if (!isMounted) return;
        applyFlagUpdate(flag);
      });

      socket.on('session:status', (data) => {
        if (!isMounted) return;
        const handled = applyStatus(data);
        if (!handled) {
          triggerDebouncedRefetch();
        }
      });

      socket.on('exam:summary', (summary) => {
        if (!isMounted) return;
        setSummary(summary);
      });
    }

    initConsole();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.emit('proctor:leave', { examId });
        socketRef.current.disconnect();
      }
      reset();
    };
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-200">Loading Proctor Console...</h2>
          <p className="text-xs text-slate-500 mt-1">Connecting telemetry and fetching candidate rosters...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-[#111827] border border-rose-500/30 p-6 rounded-xl max-w-md w-full text-center space-y-4">
          <p className="text-sm text-rose-300">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col overflow-hidden">
      {/* Dense Exam Header */}
      <ExamHeader examId={examId} />

      {/* Main Dual-Panel View: Virtualized Grid + Live Feed */}
      <main className="flex-1 p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 max-w-[1920px] w-full mx-auto overflow-hidden">
        {/* Left / Main Column: Candidate Session Grid (8 cols on lg, 9 on xl) */}
        <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-hidden">
          <SessionGrid />
        </section>

        {/* Right / Secondary Column: Real-time Flags Feed (4 cols on lg, 3 on xl) */}
        <section className="lg:col-span-4 xl:col-span-3 flex flex-col min-h-0 overflow-hidden">
          <FlagFeed />
        </section>
      </main>
    </div>
  );
}
