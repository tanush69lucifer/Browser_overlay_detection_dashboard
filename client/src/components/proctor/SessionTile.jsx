import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useLiveStore from '../../store/live';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  EyeOff, 
  ShieldCheck, 
  Radio 
} from 'lucide-react';

const SessionTile = React.memo(function SessionTile({ sessionId }) {
  const navigate = useNavigate();

  // Subscribes strictly to its own session entry to avoid unnecessary full-grid re-renders
  const session = useLiveStore(
    React.useCallback((state) => state.sessions[sessionId], [sessionId])
  );

  const [isPulsing, setIsPulsing] = useState(false);

  // 1.5s visual pulse ring on new flags or updates
  useEffect(() => {
    if (!session?.pulseAt) return;
    const elapsed = Date.now() - session.pulseAt;
    if (elapsed < 1500) {
      setIsPulsing(true);
      const timer = setTimeout(() => {
        setIsPulsing(false);
      }, 1500 - elapsed);
      return () => clearTimeout(timer);
    }
  }, [session?.pulseAt]);

  if (!session) return null;

  const {
    id,
    name,
    candidateId,
    status = 'Online',
    focused = true,
    maxSeverity = 'NONE',
    flagCount = 0,
  } = session;

  const isOnline = status === 'Online';
  const isEnded = status === 'Ended';

  // Severity display configuration
  const getSeverityBadge = () => {
    switch (maxSeverity?.toUpperCase()) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertOctagon className="w-2.5 h-2.5" />
            HIGH
          </span>
        );
      case 'MED':
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-2.5 h-2.5" />
            MED
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Info className="w-2.5 h-2.5" />
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
            <ShieldCheck className="w-2.5 h-2.5 text-slate-500" />
            CLEAR
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => navigate(`/proctor/session/${id}`)}
      className={`relative bg-[#111827] border rounded-lg p-3 cursor-pointer transition-all duration-150 select-none group hover:bg-[#162032] ${
        isPulsing
          ? 'pulse-ring-active border-rose-500'
          : maxSeverity === 'HIGH'
          ? 'border-rose-900/60 hover:border-rose-600'
          : maxSeverity === 'MED'
          ? 'border-amber-900/50 hover:border-amber-600'
          : 'border-[#1e293b] hover:border-slate-600'
      }`}
    >
      {/* Top Line: Candidate ID & Status indicator */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isOnline
                ? 'bg-emerald-400 animate-pulse'
                : isEnded
                ? 'bg-zinc-500'
                : 'bg-slate-500'
            }`}
          />
          <span className="text-[11px] text-slate-400 font-medium truncate">
            {status}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Focus Lost Warning Icon */}
          {!focused && isOnline && (
            <span
              title="Window blur / Focus lost (>10s)"
              className="p-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center animate-bounce"
            >
              <EyeOff className="w-3 h-3" />
            </span>
          )}

          {/* Severity Badge */}
          {getSeverityBadge()}
        </div>
      </div>

      {/* Middle: Candidate Name */}
      <div className="mb-2.5">
        <h4 className="text-xs font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
          {name}
        </h4>
        <span className="text-[10px] font-mono text-slate-500 truncate block">
          {candidateId || id}
        </span>
      </div>

      {/* Bottom: Flags tally */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]/70 text-[11px]">
        <span className="text-slate-500 text-[10px] flex items-center gap-1">
          <Radio className="w-2.5 h-2.5" /> Flags
        </span>
        <span
          className={`num font-bold px-1.5 py-0.2 rounded text-[11px] ${
            flagCount > 0
              ? maxSeverity === 'HIGH'
                ? 'bg-rose-500/20 text-rose-300'
                : 'bg-amber-500/20 text-amber-300'
              : 'text-slate-400'
          }`}
        >
          {flagCount}
        </span>
      </div>
    </div>
  );
});

export default SessionTile;
