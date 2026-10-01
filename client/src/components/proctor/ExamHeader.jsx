import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Wifi, 
  WifiOff, 
  FileSpreadsheet, 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  EyeOff, 
  Radio
} from 'lucide-react';
import useLiveStore from '../../store/live';

export default function ExamHeader({ examId }) {
  const exam = useLiveStore((state) => state.exam);
  const summary = useLiveStore((state) => state.summary);
  const socketConnected = useLiveStore((state) => state.socketConnected);

  const title = exam?.title || 'Monitoring Console';
  const examWindow = exam?.window || 'Active Session';

  return (
    <header className="border-b border-[#1e293b] bg-[#111827]/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-6 py-3">
      <div className="flex flex-col gap-3">
        {/* Top Row: Navigation, Title, Status, and Report Link */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/proctor"
              className="p-1.5 rounded-lg bg-[#0b0f17] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e293b] transition"
              title="Return to assigned exams"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold text-white truncate tracking-tight">
                  {title}
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400 bg-[#0b0f17] px-2 py-0.5 rounded border border-[#1e293b]">
                  {examId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{examWindow}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Socket Connection Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                socketConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {socketConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="hidden sm:inline">LIVE TELEMETRY</span>
                  <Wifi className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span className="hidden sm:inline">RECONNECTING</span>
                  <WifiOff className="w-3.5 h-3.5" />
                </>
              )}
            </div>

            {/* Link to Full Report */}
            <Link
              to={`/proctor/report/${examId}`}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </Link>
          </div>
        </div>

        {/* Bottom Row: Dense Live Metric Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {/* Online */}
          <div className="flex items-center gap-1.5 bg-[#0b0f17] px-2.5 py-1 rounded-md border border-[#1e293b]">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400 text-[11px]">Online</span>
            <span className="num font-semibold text-emerald-400 ml-0.5">
              {summary.online}/{summary.total}
            </span>
          </div>

          {/* Flagged */}
          <div className="flex items-center gap-1.5 bg-[#0b0f17] px-2.5 py-1 rounded-md border border-[#1e293b]">
            <Radio className="w-3 h-3 text-rose-400" />
            <span className="text-slate-400 text-[11px]">Flagged</span>
            <span className="num font-semibold text-rose-400 ml-0.5">
              {summary.flagged}
            </span>
          </div>

          <div className="h-4 w-px bg-[#1e293b] mx-1"></div>

          {/* HIGH */}
          <div className="flex items-center gap-1 bg-[#0b0f17] px-2 py-1 rounded-md border border-rose-500/20 text-rose-400">
            <AlertOctagon className="w-3 h-3" />
            <span className="text-[11px] text-slate-400">HIGH</span>
            <span className="num font-bold text-rose-400 ml-0.5">{summary.high}</span>
          </div>

          {/* MED */}
          <div className="flex items-center gap-1 bg-[#0b0f17] px-2 py-1 rounded-md border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[11px] text-slate-400">MED</span>
            <span className="num font-bold text-amber-400 ml-0.5">{summary.med}</span>
          </div>

          {/* LOW */}
          <div className="flex items-center gap-1 bg-[#0b0f17] px-2 py-1 rounded-md border border-sky-500/20 text-sky-400">
            <Info className="w-3 h-3" />
            <span className="text-[11px] text-slate-400">LOW</span>
            <span className="num font-bold text-sky-400 ml-0.5">{summary.low}</span>
          </div>

          {/* Focus Lost */}
          <div className="flex items-center gap-1.5 bg-[#0b0f17] px-2.5 py-1 rounded-md border border-orange-500/20 text-orange-400 ml-auto sm:ml-0">
            <EyeOff className="w-3 h-3" />
            <span className="text-slate-400 text-[11px]">Focus lost</span>
            <span className="num font-bold text-orange-400 ml-0.5">{summary.focusLost}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
