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
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Proctor workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Assigned exams</h1>
        <p className="mt-2 text-sm text-slate-300">
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
              { label: 'Live now', value: liveCount, tone: 'OK' },
              { label: 'Upcoming', value: upcomingCount, tone: 'INFO' },
              { label: 'Completed', value: endedCount, tone: 'NEUTRAL' },
            ].map((stat) => (
              <Card key={stat.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-300">{stat.label}</p>
                  <Badge tone={stat.tone}>{stat.label}</Badge>
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
              </Card>
            ))}
          </div>

          {exams.length ? (
            <div className="space-y-4">
              {exams.map((exam) => {
                const status = examStatus(exam);
                const tone = status === 'Live' ? 'OK' : status === 'Upcoming' ? 'INFO' : 'NEUTRAL';
                const examId = exam._id || exam.id;

                return (
                  <Card key={examId} className="p-5">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-semibold text-white">{exam.title}</h2>
                          <Badge tone={tone}>{status}</Badge>
                        </div>
                        <p className="text-sm text-slate-300">
                          {formatDate(exam.startAt)} <span className="text-slate-500">to</span>{' '}
                          {formatDate(exam.endAt)}
                        </p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wide text-slate-400">
                          <span>{exam.candidateCount ?? 0} candidates</span>
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
