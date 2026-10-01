import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VirtuosoGrid } from 'react-virtuoso';
import { getExam } from '../../api/exams';
import { getExamSessions } from '../../api/proctor';
import { createSocket } from '../../realtime/socket';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';

const MAX_FEED_ITEMS = 100;
const CandidateGrid = {
  List: forwardRef(function CandidateGridList({ children, style, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        style={{ ...style, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))', gap: 12 }}
      >
        {children}
      </div>
    );
  }),
  Item: ({ children, ...props }) => <div {...props} className="min-w-0">{children}</div>,
};

const severityTone = (severity) => {
  if (severity === 'HIGH') return 'HIGH';
  if (severity === 'MED') return 'MED';
  return 'LOW';
};

const signalLabel = (code) =>
  String(code || 'INTEGRITY_SIGNAL')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleTimeString();
}

function signalDescription(item) {
  const meta = item.meta || {};
  if (item.code === 'KNOWN_FINGERPRINT') {
    return [meta.name, meta.tool].filter(Boolean).join(' · ') || 'Configured fingerprint matched';
  }
  if (item.code === 'PASTE_EVENT') return 'Paste event captured; clipboard content is not collected.';
  if (item.code === 'FULLSCREEN_EXIT') return 'Candidate left fullscreen during the exam.';
  if (item.code === 'TAB_HIDDEN') return 'Exam tab became hidden.';
  if (item.code === 'TAB_VISIBLE') return 'Exam tab became visible again.';
  if (item.code === 'WINDOW_BLUR') return 'Exam window lost focus.';
  if (item.code === 'BROWSER_TAB_SWITCH') {
    const destination = [meta.title, meta.url].filter(Boolean).join(' · ') || 'Unknown browser tab';
    return `${meta.isExamTab ? 'Candidate returned to the exam tab' : 'Candidate switched to another browser tab'} · ${destination}`;
  }
  if (item.code === 'FIXED_HIGH_Z_NODE' && meta.persistentMs) {
    return `Persistent fixed overlay · z-index ${meta.zIndex} · ${Math.round(Number(meta.areaRatio) * 100)}% viewport`;
  }
  if (item.code === 'EXTENSION_IFRAME') return `Extension frame detected · ${meta.extensionOrigin || 'unknown origin'}`;
  if (item.code === 'DEVTOOLS_OPEN') return 'Possible developer-tools window-size change.';
  return item.code;
}

function flagTitle(flag) {
  if (flag.code === 'KNOWN_FINGERPRINT') {
    const signals = Array.isArray(flag.evidence?.signals) ? flag.evidence.signals : [];
    const fingerprint = signals.find((signal) => signal.code === 'KNOWN_FINGERPRINT');
    return fingerprint?.meta?.allowed
      ? 'Configured allowed tool detected'
      : 'Potential overlay/helper tool detected';
  }
  if (flag.code === 'FIXED_HIGH_Z_NODE') return 'Potential floating overlay detected';
  if (flag.code === 'EXTENSION_IFRAME') return 'Browser extension frame detected';
  return `Integrity signal flagged for review · ${signalLabel(flag.code)}`;
}

function flagTool(flag) {
  if (flag.evidence?.tool) return flag.evidence.tool;
  const signals = Array.isArray(flag.evidence?.signals) ? flag.evidence.signals : [];
  const fingerprint = signals.find((signal) => signal.code === 'KNOWN_FINGERPRINT');
  return fingerprint?.meta?.name || fingerprint?.meta?.tool || null;
}

function flagEventTime(flag) {
  const signals = Array.isArray(flag.evidence?.signals) ? flag.evidence.signals : [];
  const relevantSignal = signals.find((signal) =>
    ['KNOWN_FINGERPRINT', 'EXTENSION_IFRAME', 'FIXED_HIGH_Z_NODE'].includes(signal.code)
  );
  return relevantSignal?.t || flag.t || flag.raisedAt;
}

export default function Console() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [feed, setFeed] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pulsingSessions, setPulsingSessions] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const pulseTimers = useRef(new Map());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const loadSessions = useCallback(async () => {
    const payload = await getExamSessions(examId, { page: 1, limit: 500 });
    setSessions(Array.isArray(payload?.items) ? payload.items : []);
  }, [examId]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [examPayload] = await Promise.all([getExam(examId), loadSessions()]);
      const examData = examPayload?.exam || examPayload;
      if (!examData) throw new Error('Exam details were not returned');
      setExam(examData);
    } catch (err) {
      setError(err?.message || 'Unable to load the live exam console');
    } finally {
      setLoading(false);
    }
  }, [examId, loadSessions]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const socket = createSocket();
    socket.on('connect', () => {
      setRealtimeConnected(true);
      socket.emit('proctor:join', { examId }, (ack) => {
        if (!ack?.ok) {
          setError(ack?.error === 'FORBIDDEN' ? 'You are not assigned to this exam.' : 'Unable to join the live exam feed.');
          return;
        }
        if (ack.summary) setSummary(ack.summary);
        loadSessions().catch((err) => setError(err?.message || 'Unable to refresh exam sessions'));
      });
    });
    socket.on('disconnect', () => setRealtimeConnected(false));
    socket.on('connect_error', () => setRealtimeConnected(false));

    socket.on('session:status', (event) => {
      setSessions((current) => {
        const exists = current.some((session) => String(session._id) === String(event.sessionId));
        if (!exists && event.candidate) {
          return [...current, {
            _id: String(event.sessionId),
            candidate: event.candidate,
            status: event.status === 'FLAGGED' ? 'ONLINE' : event.status,
            flagCount: 0,
            maxSeverity: event.maxSeverity || 'NONE',
          }];
        }
        return current.map((session) =>
          String(session._id) === String(event.sessionId)
            ? {
                ...session,
                status: event.status === 'FLAGGED' ? session.status : event.status,
                maxSeverity: event.maxSeverity || session.maxSeverity,
              }
            : session
        );
      });
    });

    socket.on('exam:summary', (summary) => {
      setSummary(summary);
    });

    socket.on('signal:new', (event) => {
      setFeed((current) => [{ ...event, kind: 'SIGNAL' }, ...current].slice(0, MAX_FEED_ITEMS));
    });

    socket.on('flag:new', (event) => {
      setFeed((current) => [{ ...event, kind: 'FLAG' }, ...current].slice(0, MAX_FEED_ITEMS));
      const sessionKey = String(event.sessionId);
      const oldTimer = pulseTimers.current.get(sessionKey);
      if (oldTimer) clearTimeout(oldTimer);
      setPulsingSessions((current) => new Set(current).add(sessionKey));
      pulseTimers.current.set(sessionKey, setTimeout(() => {
        pulseTimers.current.delete(sessionKey);
        setPulsingSessions((current) => {
          const next = new Set(current);
          next.delete(sessionKey);
          return next;
        });
      }, 3000));
      setSessions((current) => {
        const exists = current.some((session) => String(session._id) === String(event.sessionId));
        if (!exists) {
          return [...current, {
            _id: String(event.sessionId),
            candidate: event.candidate || { name: 'Candidate' },
            status: 'ONLINE',
            flagCount: 1,
            maxSeverity: event.severity,
          }];
        }
        return current.map((session) =>
          String(session._id) === String(event.sessionId)
            ? {
                ...session,
                flagCount: Number(session.flagCount || 0) + 1,
                maxSeverity: event.severity,
              }
            : session
        );
      });
      setSummary((current) => current ? {
        ...current,
        flaggedCount: Number(current.flaggedCount || 0) + (
          sessionsRef.current.find((session) => String(session._id) === sessionKey)?.flagCount ? 0 : 1
        ),
        bySeverity: {
          ...current.bySeverity,
          [event.severity]: Number(current.bySeverity?.[event.severity] || 0) + 1,
        },
      } : current);
    });

    socket.on('flag:updated', ({ flag }) => {
      if (!flag) return;
      setFeed((current) =>
        current.map((item) =>
          item.kind === 'FLAG' && String(item._id) === String(flag._id) ? { ...item, ...flag } : item
        )
      );
    });

    return () => {
      socket.emit('proctor:leave', { examId });
      socket.disconnect();
      for (const timer of pulseTimers.current.values()) clearTimeout(timer);
      pulseTimers.current.clear();
    };
  }, [examId, loadSessions]);

  const displayedSessions = useMemo(() => {
    const presentCandidateIds = new Set(
      sessions.map((session) => String(session.candidate?._id || session.candidate?.id || session.candidateId || ''))
    );
    const pending = (exam?.candidates || [])
      .filter((candidate) => !presentCandidateIds.has(String(candidate._id || candidate.id)))
      .map((candidate) => ({
        _id: `pending-${candidate._id || candidate.id}`,
        candidate,
        status: 'OFFLINE',
        flagCount: 0,
        maxSeverity: 'NONE',
        pending: true,
      }));
    return [...sessions, ...pending];
  }, [exam, sessions]);

  const counts = useMemo(() => {
    const flagged = sessions.filter((session) => Number(session.flagCount) > 0);
    return {
      online: Number(summary?.online ?? displayedSessions.filter((session) => session.status === 'ONLINE').length),
      offline: displayedSessions.filter((session) => session.status === 'OFFLINE').length,
      flagged: Number(summary?.flaggedCount ?? flagged.length),
      low: Number(summary?.bySeverity?.LOW ?? flagged.filter((session) => session.maxSeverity === 'LOW').length),
      medium: Number(summary?.bySeverity?.MED ?? flagged.filter((session) => session.maxSeverity === 'MED').length),
      high: Number(summary?.bySeverity?.HIGH ?? flagged.filter((session) => session.maxSeverity === 'HIGH').length),
    };
  }, [displayedSessions, sessions, summary]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error && !exam) return <ErrorState message={error} onRetry={loadDashboard} />;
  if (!exam) return <ErrorState message="Exam not found." onRetry={loadDashboard} />;

  const statItems = [
    ['Online', counts.online, 'OK'],
    ['Offline', counts.offline, 'NEUTRAL'],
    ['Flagged candidates', counts.flagged, 'WARNING'],
    ['Low severity', counts.low, 'LOW'],
    ['Medium severity', counts.medium, 'MED'],
    ['High severity', counts.high, 'HIGH'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => navigate('/proctor')}>
            ← Assigned exams
          </button>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">Live proctor console</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{exam.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/proctor/exam/${examId}/report`)}>Reports</Button>
          <Badge tone={realtimeConnected ? 'OK' : 'WARNING'}>
            {realtimeConnected ? 'Live feed connected' : 'Reconnecting to live feed'}
          </Badge>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={loadDashboard} /> : null}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statItems.map(([label, value, tone]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            <Badge className="mt-2" tone={tone}>{label}</Badge>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Candidate sessions</h2>
            <p className="mt-1 text-sm text-slate-400">Select a candidate to inspect their session and review flags.</p>
          </div>
          {displayedSessions.length ? (
            <VirtuosoGrid
              style={{ height: '38rem' }}
              data={displayedSessions}
              components={CandidateGrid}
              overscan={500}
              computeItemKey={(_, session) => String(session.candidate?._id || session.candidate?.id || session._id)}
              itemContent={(_, session) => {
                const candidate = session.candidate || {};
                const isFlagged = Number(session.flagCount) > 0;
                const status = isFlagged ? 'FLAGGED' : session.status || 'OFFLINE';
                const tone = status === 'ONLINE' ? 'OK' : status === 'FLAGGED' ? 'HIGH' : 'NEUTRAL';
                const isPulsing = pulsingSessions.has(String(session._id));
                return (
                  <button
                    type="button"
                    key={session._id}
                    disabled={session.pending}
                    onClick={() => navigate(`/proctor/session/${session._id}`)}
                    aria-label={`${candidate.name || 'Candidate'}, ${status}, ${session.flagCount || 0} flags`}
                    className="text-left disabled:cursor-not-allowed"
                  >
                    <Card className={`h-full transition hover:border-primary/70 ${isPulsing ? 'animate-pulse border-danger ring-2 ring-danger/40' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-white">{candidate.name || 'Candidate'}</h3>
                          <p className="mt-1 truncate text-xs text-slate-400">{candidate.email || 'Candidate session'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={tone}>{status}</Badge>
                          <span className={`text-xs ${session.status === 'ONLINE' ? 'text-ok' : 'text-slate-400'}`}>
                            {session.status === 'ONLINE' ? '● Online' : session.status === 'ENDED' ? '■ Ended' : '○ Offline'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                        <span>{session.flagCount || 0} flags</span>
                        <Badge tone={severityTone(session.maxSeverity)}>{session.maxSeverity || 'NONE'}</Badge>
                      </div>
                    </Card>
                  </button>
                );
              }}
            />
          ) : (
            <EmptyState title="No candidate sessions yet" hint="Sessions will appear here as assigned candidates start the exam." />
          )}
        </section>

        <aside className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Live signal and flag feed</h2>
            <p className="mt-1 text-sm text-slate-400">Focus events are signals; scoring thresholds determine when a flag is raised.</p>
          </div>
          <Card className="max-h-[38rem] space-y-3 overflow-y-auto p-3">
            {feed.length ? feed.map((item) => (
              <div key={item.id || item._id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">
                      {item.kind === 'FLAG' ? flagTitle(item) : signalLabel(item.code)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.candidate?.name || 'Candidate'} · {formatTime(item.kind === 'FLAG' ? flagEventTime(item) : item.t || item.raisedAt)}
                    </p>
                  </div>
                  <Badge tone={severityTone(item.severity)}>{item.severity || 'LOW'}</Badge>
                </div>
                {item.kind === 'FLAG' ? (
                  <>
                    {flagTool(item) ? (
                      <p className="mt-2 text-sm text-slate-300">Detected tool: <span className="font-medium text-white">{flagTool(item)}</span></p>
                    ) : null}
                    <Button
                      variant="ghost"
                      className="mt-3 w-full"
                      onClick={() => navigate(`/proctor/session/${item.sessionId}`)}
                    >
                      View Evidence
                    </Button>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">{signalDescription(item)}</p>
                )}
              </div>
            )) : (
              <p className="py-8 text-center text-sm text-slate-400">
                Waiting for candidate focus, overlay, and integrity signals…
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
