import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExams } from '../../api/exams';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';

const statusByDate = (startAt, endAt) => {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : null;
  const end = endAt ? new Date(endAt).getTime() : null;

  if (end && now > end) return 'Ended';
  if (start && now >= start) return 'Live';
  return 'Upcoming';
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function MyExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadExams = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await getExams({ page: 1, limit: 20 });
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      setExams(items);
    } catch (err) {
      setError(err?.message || 'Unable to load your exam list');
    } finally {
      setLoading(false);
    }
  };

  const startExam = async (examId) => {
    // Enter the rules page first. Fullscreen is requested by the explicit
    // confirmation button there, so the browser handles it in that click's
    // user-activation context rather than before route navigation.
    navigate(`/candidate/exam/${examId}`);
  };

  useEffect(() => {
    loadExams();
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((row) => (
            <Card key={row} className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-28" />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return <ErrorState message={error} onRetry={loadExams} />;
    }

    if (!exams.length) {
      return (
        <EmptyState
          title="No exams available"
          hint="Your assigned exam windows will appear here when a proctor adds them."
        />
      );
    }

    return (
      <div className="space-y-4">
        {exams.map((exam) => {
          const status = statusByDate(exam.startAt, exam.endAt);
          const isLive = status === 'Live';
          const statusTone = isLive ? 'OK' : status === 'Upcoming' ? 'INFO' : 'NEUTRAL';
          return (
            <Card key={exam._id || exam.id} className="p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{exam.title}</h2>
                    <Badge tone={statusTone}>{status}</Badge>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500">Starts:</span> {formatDate(exam.startAt)}
                    </div>
                    <div>
                      <span className="text-slate-500">Ends:</span> {formatDate(exam.endAt)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                    <span>{exam.sensitivity || 'MEDIUM'}</span>
                    <span>•</span>
                    <span>{exam.durationMin || 60} minutes</span>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant={isLive ? 'primary' : 'ghost'}
                    disabled={!isLive}
                    onClick={() => startExam(exam._id || exam.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.preventDefault();
                    }}
                  >
                    {isLive ? 'Start' : 'Not live'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }, [error, exams, loading, navigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Candidate portal</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">My exams</h1>
        </div>
      </div>
      {content}
    </div>
  );
}
