import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
    if (!document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) {
        toast.error('Fullscreen is required to start this exam, but is not supported by this browser.');
        return;
      }

      try {
        await document.documentElement.requestFullscreen();
      } catch {
        toast.error('Allow fullscreen to start the exam.');
        return;
      }

      if (!document.fullscreenElement) {
        toast.error('Fullscreen is required to start this exam. Please try again.');
        return;
      }
    }

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

    const isCompleted = (exam) => exam.mySessionStatus === 'ENDED';
    const liveCount = exams.filter((exam) => !isCompleted(exam) && statusByDate(exam.startAt, exam.endAt) === 'Live').length;
    const upcomingCount = exams.filter((exam) => !isCompleted(exam) && statusByDate(exam.startAt, exam.endAt) === 'Upcoming').length;
    const endedCount = exams.filter((exam) => isCompleted(exam) || statusByDate(exam.startAt, exam.endAt) === 'Ended').length;

    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Ready to start', value: liveCount, tone: 'OK' },
            { label: 'Upcoming', value: upcomingCount, tone: 'INFO' },
            { label: 'Completed', value: endedCount, tone: 'NEUTRAL' },
          ].map((stat) => (
            <Card key={stat.label} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-slate-300">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white num">{stat.value}</p>
              </div>
              <Badge tone={stat.tone}>{stat.label}</Badge>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {exams.map((exam) => {
          const completed = isCompleted(exam);
          const status = completed ? 'Completed' : statusByDate(exam.startAt, exam.endAt);
          const isLive = status === 'Live';
          const canResume = !completed && Boolean(exam.mySessionStatus);
          const statusTone = isLive ? 'OK' : status === 'Upcoming' ? 'INFO' : 'NEUTRAL';
          return (
            <Card key={exam._id || exam.id} className="p-4 hover:border-slate-500/80 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{exam.title}</h2>
                    <Badge tone={statusTone}>{status}</Badge>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/70 bg-slate-950/30 px-3 py-2">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">Starts</span>
                      <span className="mt-1 block text-sm text-slate-200">{formatDate(exam.startAt)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-slate-950/30 px-3 py-2">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">Ends</span>
                      <span className="mt-1 block text-sm text-slate-200">{formatDate(exam.endAt)}</span>
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
                    variant={isLive && !completed ? 'primary' : 'ghost'}
                    disabled={!isLive || completed}
                    onClick={() => startExam(exam._id || exam.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.preventDefault();
                    }}
                  >
                    {completed ? 'Completed' : isLive ? (canResume ? 'Resume' : 'Start') : 'Not live'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        </div>
      </div>
    );
  }, [error, exams, loading, navigate]);

  return (
    <div className="relative z-10 space-y-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Candidate portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">My exams</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Your assigned assessments and their scheduled availability.</p>
        </div>
      </div>
      {content}
    </div>
  );
}
