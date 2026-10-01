import React, { useState } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  ShieldAlert, 
  FileText, 
  Clock, 
  Table, 
  Check
} from 'lucide-react';

const getPlainCode = (code, plainCode) => {
  if (plainCode) return plainCode;
  switch (code) {
    case 'OVERLAY_DETECTED':
      return 'Browser Overlay Detected (Transparent Window / Alt+O)';
    case 'WINDOW_BLUR':
    case 'WINDOW_BLUR_PERSISTENT':
      return 'Window Focus Lost (>10s Duration)';
    case 'MULTIPLE_DISPLAYS':
    case 'MULTIPLE_DISPLAYS_ACTIVE':
      return 'Secondary Virtual Screen / Display Adapter Discrepancy';
    case 'DEVTOOLS_OPEN':
      return 'Browser Developer Tools Opened';
    case 'EXTENSION_DOM':
    case 'BROWSER_EXTENSION_INJECTION':
      return 'Extension DOM Injection (e.g. Grammarly / AI Assistant)';
    default:
      return code || 'Integrity Anomaly';
  }
};

export default function FlagTimeline({ flags = [], onUpdateFlag }) {
  const [localNotes, setLocalNotes] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  const handleNoteChange = (flagId, text) => {
    setLocalNotes((prev) => ({ ...prev, [flagId]: text }));
  };

  const handleApplyVerdict = async (flag, verdict) => {
    setSubmittingId(flag.id);
    const note = localNotes[flag.id] !== undefined ? localNotes[flag.id] : (flag.note || '');
    await onUpdateFlag(flag.id, {
      verdict,
      note,
      reviewed: true,
    });
    setSubmittingId(null);
  };

  const handleMarkReviewed = async (flag) => {
    setSubmittingId(flag.id);
    const note = localNotes[flag.id] !== undefined ? localNotes[flag.id] : (flag.note || '');
    await onUpdateFlag(flag.id, {
      reviewed: true,
      note,
      verdict: flag.verdict || 'REVIEWED',
    });
    setSubmittingId(null);
  };

  if (!flags || flags.length === 0) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-8 text-center text-slate-400">
        <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-80" />
        <h3 className="text-sm font-semibold text-slate-200">No flags recorded</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          No anomalous overlay activity or focus violations have been flagged for this candidate.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#1e293b]">
      {flags.map((flag, idx) => {
        const isHigh = flag.severity === 'HIGH';
        const isMed = flag.severity === 'MED' || flag.severity === 'MEDIUM';
        const isLow = flag.severity === 'LOW';

        const borderColor = isHigh
          ? 'border-rose-500/50'
          : isMed
          ? 'border-amber-500/50'
          : 'border-sky-500/50';

        const dotColor = isHigh
          ? 'bg-rose-500 ring-rose-500/20'
          : isMed
          ? 'bg-amber-500 ring-amber-500/20'
          : 'bg-sky-500 ring-sky-500/20';

        const currentNote = localNotes[flag.id] !== undefined ? localNotes[flag.id] : (flag.note || '');

        return (
          <div key={flag.id || idx} className="relative group">
            {/* Timeline Node Icon */}
            <div
              className={`absolute -left-6 top-3 w-5 h-5 rounded-full flex items-center justify-center ring-4 ${dotColor} bg-[#0b0f17] text-white text-[10px]`}
            >
              {isHigh ? (
                <AlertOctagon className="w-3 h-3 text-rose-400" />
              ) : isMed ? (
                <AlertTriangle className="w-3 h-3 text-amber-400" />
              ) : (
                <Info className="w-3 h-3 text-sky-400" />
              )}
            </div>

            {/* Timeline Item Content Card */}
            <div className={`bg-[#111827] border ${borderColor} rounded-xl p-4 sm:p-5 shadow-sm space-y-4`}>
              {/* Header: Title, Severity, Time, Confidence */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isHigh
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : isMed
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {flag.severity || 'FLAGGED'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-100">
                      {getPlainCode(flag.code, flag.plainCode)}
                    </h4>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    Event Code: <span className="text-slate-300">{flag.code || 'UNKNOWN_CODE'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 self-start sm:self-auto">
                  {flag.score !== undefined && (
                    <div className="bg-[#0b0f17] px-2 py-1 rounded border border-[#1e293b]">
                      <span className="text-[10px] text-slate-500 mr-1">Anomaly:</span>
                      <span className="num font-bold text-slate-200">
                        {(flag.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{flag.createdAt ? new Date(flag.createdAt).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Evidence Signals Table */}
              {flag.evidence && flag.evidence.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Table className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Telemetry Evidence Signals</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[#1e293b]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#0b0f17] text-slate-400 border-b border-[#1e293b] text-[11px]">
                          <th className="py-1.5 px-3 font-medium">Signal Code</th>
                          <th className="py-1.5 px-3 font-medium">Severity</th>
                          <th className="py-1.5 px-3 font-medium">Telemetry Metadata</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e293b]/60 bg-[#0f172a]">
                        {flag.evidence.map((sig, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-800/40">
                            <td className="py-1.5 px-3 font-mono text-[11px] text-indigo-300">
                              {sig.code}
                            </td>
                            <td className="py-1.5 px-3">
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  sig.severity === 'HIGH'
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : sig.severity === 'MED'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-sky-500/10 text-sky-400'
                                }`}
                              >
                                {sig.severity}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-slate-300 text-[11px]">
                              {sig.meta}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Review Status & Verdict Badge */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 text-[11px]">Proctor Review:</span>
                {flag.reviewed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Check className="w-3 h-3" /> Reviewed
                    {flag.verdict && ` • Verdict: ${flag.verdict}`}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Pending Review
                  </span>
                )}
              </div>

              {/* Proctor Notes Textarea */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-400">
                  Proctor Observation Note
                </label>
                <textarea
                  rows={2}
                  value={currentNote}
                  onChange={(e) => handleNoteChange(flag.id, e.target.value)}
                  placeholder="Record objective observations (e.g. candidate informed of window blur, verified overlay window)..."
                  className="w-full bg-[#0b0f17] border border-[#1e293b] rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Action Buttons: Verdict & Reviewed */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1e293b]/60">
                <div className="flex items-center gap-2">
                  <button
                    disabled={submittingId === flag.id}
                    onClick={() => handleApplyVerdict(flag, 'SUSPICIOUS')}
                    className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    Mark Suspicious
                  </button>
                  <button
                    disabled={submittingId === flag.id}
                    onClick={() => handleApplyVerdict(flag, 'CLEARED')}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    Clear Incident
                  </button>
                </div>

                <button
                  disabled={submittingId === flag.id}
                  onClick={() => handleMarkReviewed(flag)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Reviewed</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
