import React from 'react';
import { useNavigate } from 'react-router-dom';
import useLiveStore from '../../store/live';
import { 
  Radio, 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

// Format relative timestamp (e.g., '12s ago', '2m ago')
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
};

// Map raw code to plain words fallback
const getPlainCode = (code, plainCode) => {
  if (plainCode) return plainCode;
  switch (code) {
    case 'OVERLAY_DETECTED':
      return 'Browser Overlay Detected';
    case 'WINDOW_BLUR':
    case 'WINDOW_BLUR_PERSISTENT':
      return 'Window Lost Focus (>10s)';
    case 'MULTIPLE_DISPLAYS':
    case 'MULTIPLE_DISPLAYS_ACTIVE':
      return 'Secondary Display / Mirroring';
    case 'DEVTOOLS_OPEN':
      return 'Browser DevTools Opened';
    case 'EXTENSION_DOM':
    case 'BROWSER_EXTENSION_INJECTION':
      return 'DOM Extension Injection (Grammarly/AI)';
    default:
      return code || 'Anomaly Detected';
  }
};

export default function FlagFeed() {
  const navigate = useNavigate();
  const feed = useLiveStore((state) => state.feed);

  return (
    <aside className="bg-[#111827] border border-[#1e293b] rounded-lg flex flex-col h-full overflow-hidden">
      {/* Feed Header */}
      <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-[#151d2a]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Live Anomaly Feed
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-[#0b0f17] px-2 py-0.5 rounded border border-[#1e293b]">
          <span className="num font-semibold text-rose-400">{feed.length}</span>/100
        </span>
      </div>

      {/* Feed Items Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1e293b]/60 p-2 space-y-1.5 max-h-[calc(100vh-210px)]">
        {feed.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs px-4">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
            <p className="font-medium text-slate-400">Monitoring incoming telemetry...</p>
            <p className="text-[11px] mt-1 text-slate-500">
              Flags, overlays, and focus-lost events will stream here automatically.
            </p>
          </div>
        ) : (
          feed.map((flag) => {
            const isHigh = flag.severity === 'HIGH';
            const isMed = flag.severity === 'MED' || flag.severity === 'MEDIUM';

            return (
              <div
                key={flag.id}
                onClick={() => navigate(`/proctor/session/${flag.sessionId}`)}
                className="p-2.5 rounded-lg bg-[#0b0f17] hover:bg-[#162032] border border-[#1e293b] hover:border-slate-600 transition cursor-pointer group"
              >
                {/* Top: Severity Badge, Score, and Relative Time */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isHigh ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertOctagon className="w-2.5 h-2.5" />
                        HIGH
                      </span>
                    ) : isMed ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        MED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                        <Info className="w-2.5 h-2.5" />
                        LOW
                      </span>
                    )}

                    {flag.score !== undefined && (
                      <span className="num text-[10px] text-slate-400 font-mono bg-slate-900 px-1 rounded">
                        {(flag.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formatRelativeTime(flag.createdAt)}</span>
                  </span>
                </div>

                {/* Candidate & Anomaly Explanation */}
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                    {flag.candidateName || `Candidate ${flag.sessionId}`}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    {getPlainCode(flag.code, flag.plainCode)}
                  </p>
                </div>

                {/* Bottom link indicator */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#1e293b]/40 text-[10px] text-slate-400">
                  <span className="font-mono text-slate-400 truncate max-w-[140px]">
                    ID: {flag.sessionId}
                  </span>
                  <span className="flex items-center gap-1 text-indigo-400 group-hover:underline">
                    <span>Inspect</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
