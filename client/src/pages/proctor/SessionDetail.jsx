import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSession, getSessionFlags, reviewFlag } from '../../api/proctor';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';

const severityTone = (severity) => (severity === 'HIGH' ? 'HIGH' : severity === 'MED' ? 'MED' : 'LOW');

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function SessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [flags, setFlags] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [sessionPayload, flagsPayload] = await Promise.all([
        getSession(sessionId),
        getSessionFlags(sessionId),
      ]);
      const sessionData = sessionPayload?.session || sessionPayload;
      const flagList = Array.isArray(flagsPayload?.items) ? flagsPayload.items : [];
      setSession(sessionData);
      setFlags(flagList);
      setDrafts(Object.fromEntries(flagList.map((flag) => [
        flag._id,
        { note: flag.note || '', verdict: flag.verdict || '' },
      ])));
    } catch (err) {
      setError(err?.message || 'Unable to load candidate session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const saveReview = async (flag) => {
    const draft = drafts[flag._id] || { note: '', verdict: '' };
    try {
      setSavingId(flag._id);
      const payload = await reviewFlag(flag._id, {
        reviewed: true,
        note: draft.note,
        verdict: draft.verdict || null,
      });
      const updated = payload?.flag || payload;
      setFlags((current) => current.map((item) => item._id === flag._id ? updated : item));
      toast.success('Flag review saved');
    } catch (err) {
      toast.error(err?.message || 'Unable to save flag review');
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={loadSession} />;
  if (!session) return <EmptyState title="Session not found" hint="This candidate session may no longer be available." />;

  const candidate = session.candidate || {};

  return (
    <div className="space-y-6">
      <div>
        <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => navigate(-1)}>
          ← Back to live console
        </button>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">Candidate drill-down</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{candidate.name || 'Candidate'}</h1>
        <p className="mt-2 text-sm text-slate-300">{candidate.email}</p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-white">Exam session</h2>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-slate-400">Exam</p><p className="mt-1 text-white">{session.exam?.title || 'Exam'}</p></div>
          <div><p className="text-slate-400">Connection</p><div className="mt-1"><Badge tone={session.status === 'ONLINE' ? 'OK' : 'NEUTRAL'}>{session.status}</Badge></div></div>
          <div><p className="text-slate-400">Started</p><p className="mt-1 text-white">{formatDate(session.startedAt)}</p></div>
          <div><p className="text-slate-400">Last heartbeat</p><p className="mt-1 text-white">{formatDate(session.lastHeartbeat)}</p></div>
        </div>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Flag timeline</h2>
          <p className="mt-1 text-sm text-slate-400">Review evidence and record a verdict for each flag.</p>
        </div>
        {flags.length ? flags.map((flag) => {
          const draft = drafts[flag._id] || { note: '', verdict: '' };
          return (
            <Card key={flag._id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{String(flag.code).replaceAll('_', ' ')}</h3>
                  <p className="mt-1 text-sm text-slate-400">{formatDate(flag.raisedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={severityTone(flag.severity)}>{flag.severity}</Badge>
                  <Badge tone={flag.reviewed ? 'OK' : 'WARNING'}>{flag.reviewed ? 'Reviewed' : 'Needs review'}</Badge>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Evidence</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-200">
                  {JSON.stringify(flag.evidence || {}, null, 2)}
                </pre>
              </div>

              <label className="block space-y-2 text-sm text-slate-300">
                <span>Proctor note</span>
                <textarea
                  value={draft.note}
                  maxLength={1000}
                  onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [flag._id]: { ...draft, note: event.target.value },
                  }))}
                  rows={3}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Add review notes"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block space-y-2 text-sm text-slate-300">
                  <span>Verdict</span>
                  <select
                    value={draft.verdict}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [flag._id]: { ...draft, verdict: event.target.value },
                    }))}
                    className="block rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-white"
                  >
                    <option value="">No verdict</option>
                    <option value="SUSPICIOUS">Suspicious</option>
                    <option value="CLEARED">Cleared</option>
                  </select>
                </label>
                <Button loading={savingId === flag._id} onClick={() => saveReview(flag)}>
                  Save review
                </Button>
              </div>
            </Card>
          );
        }) : (
          <EmptyState title="No flags for this session" hint="Integrity events are shown in the live exam feed; flags appear here when scoring reaches the configured threshold." />
        )}
      </section>
    </div>
  );
}
