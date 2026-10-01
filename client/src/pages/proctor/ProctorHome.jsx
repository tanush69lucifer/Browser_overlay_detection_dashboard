import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExams } from '../../api/exams';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';

function examStatus(exam) {
  const now = Date.now();
  const start = new Date(exam.startAt).getTime();
  const end = new Date(exam.endAt).getTime();
  if (Number.isFinite(end) && now > end) return 'Ended';
  if (Number.isFinite(start) && now >= start) return 'Live';
  return 'Upcoming';
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Schedule unavailable'
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ProctorHome() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadExams = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await getExams({ page: 1, limit: 100 });
      setExams(Array.isArray(payload?.items) ? payload.items : []);
    } catch (err) {
      setError(err?.message || 'Unable to load assigned exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const liveCount = exams.filter((exam) => examStatus(exam) === 'Live').length;
  const upcomingCount = exams.filter((exam) => examStatus(exam) === 'Upcoming').length;
  const endedCount = exams.length - liveCount - upcomingCount;

  return (
    <div className="relative z-10 space-y-7">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Proctor workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Assigned exams</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Review exam windows and open the live monitoring console for an exam.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Card key={item}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-4 h-8 w-12" />
              </Card>
            ))}
          </div>
          {[1, 2].map((item) => (
            <Card key={item}>
              <Skeleton className="h-6 w-56" />
              <Skeleton className="mt-4 h-4 w-72" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadExams} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Live now', value: liveCount, tone: 'OK', detail: 'Ready for monitoring' },
              { label: 'Upcoming', value: upcomingCount, tone: 'INFO', detail: 'Scheduled sessions' },
              { label: 'Completed', value: endedCount, tone: 'NEUTRAL', detail: 'Past exam windows' },
            ].map((stat) => (
              <Card key={stat.label} className="relative overflow-hidden">
                <span className={`absolute inset-y-0 left-0 w-1 ${stat.tone === 'OK' ? 'bg-ok' : stat.tone === 'INFO' ? 'bg-info' : 'bg-slate-500'}`} />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-200">{stat.label}</p>
                  <Badge tone={stat.tone}>{stat.label}</Badge>
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
              </Card>
            ))}
          </div>

          {exams.length ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Your exam schedule</h2>
                <span className="text-sm text-slate-400">{exams.length} total</span>
              </div>
              {exams.map((exam) => {
                const status = examStatus(exam);
                const tone = status === 'Live' ? 'OK' : status === 'Upcoming' ? 'INFO' : 'NEUTRAL';
                const examId = exam._id || exam.id;

                return (
                  <Card key={examId} className="p-5 hover:border-slate-500/80">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold text-white">{exam.title}</h3>
                          <Badge tone={tone}>{status}</Badge>
                        </div>
                        <p className="text-sm text-slate-300">
                          <span className="mr-2 text-slate-500">Schedule</span>
                          {formatDate(exam.startAt)} <span className="text-slate-500">to</span>{' '}
                          {formatDate(exam.endAt)}
                        </p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wide text-slate-400">
                          <span>{exam.candidateCount ?? 0} candidates assigned</span>
                          <span>{exam.sensitivity || 'MEDIUM'} sensitivity</span>
                        </div>
                      </div>
                      <Button onClick={() => navigate(`/proctor/exam/${examId}`)}>
                        {status === 'Live' ? 'Open live console' : 'View exam'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No exams assigned"
              hint="Exams assigned to your proctor account will appear here."
            />
          )}
        </>
      )}
    </div>
  );
}
