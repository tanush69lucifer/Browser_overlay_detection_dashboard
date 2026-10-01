import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { endSession, getExam, startSession } from '../../api/exams';
import { createSocket } from '../../realtime/socket';
import { startDetector } from '../../detector';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

const formatTime = (ms) => {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const clampToSet = (value) => (value === undefined || value === null ? '' : value);

export default function ExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const stopDetectorRef = useRef(null);
  const activeSessionRef = useRef(false);

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monitoringStarted, setMonitoringStarted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [browserExtensionConnected, setBrowserExtensionConnected] = useState(false);
  const [fingerprints, setFingerprints] = useState([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const cleanupSession = () => {
    if (stopDetectorRef.current) {
      void stopDetectorRef.current().catch((err) => {
        console.warn('[Exam] Unable to flush queued integrity signals during cleanup:', err);
      });
      stopDetectorRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (activeSessionRef.current && document.fullscreenElement && document.exitFullscreen) {
      activeSessionRef.current = false;
      document.exitFullscreen().catch((err) => {
        console.warn('[Exam] Unable to exit fullscreen:', err.message);
      });
    }
  };

  const closeExamRules = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch((err) => {
        console.warn('[Exam] Unable to exit fullscreen:', err.message);
      });
    }
    navigate('/candidate');
  };

  const loadExam = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getExam(examId);
      const examData = data?.exam || data;
      setExam(examData);
      setFingerprints(Array.isArray(examData?.fingerprints) ? examData.fingerprints : []);
      const totalMs = examData?.durationMin ? Number(examData.durationMin) * 60 * 1000 : 0;
      const endAt = examData?.endAt ? new Date(examData.endAt).getTime() : Date.now() + totalMs;
      setRemainingMs(endAt - Date.now());
    } catch (err) {
      setError(err?.message || 'Unable to load exam');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExam();
    return () => cleanupSession();
  }, [examId]);

  useEffect(() => {
    if (!exam || !monitoringStarted || !sessionStartedAt) return undefined;

    const tick = () => {
      const durationMs = Number(exam.durationMin || 60) * 60 * 1000;
      const startedAt = new Date(sessionStartedAt).getTime();
      const durationDeadline = startedAt + durationMs;
      const examDeadline = exam.endAt ? new Date(exam.endAt).getTime() : Number.POSITIVE_INFINITY;
      const deadline = Math.min(durationDeadline, examDeadline);
      setRemainingMs(deadline - Date.now());
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [exam, monitoringStarted, sessionStartedAt]);

  useEffect(() => {
    if (!monitoringStarted || remainingMs > 0 || submitted || !sessionId) return;
    handleSubmit();
  }, [monitoringStarted, remainingMs, submitted, sessionId]);

  const handleSubmit = async () => {
    if (!sessionId || submitting || submitted) return;

    try {
      setSubmitting(true);
      if (stopDetectorRef.current) {
        const stopDetector = stopDetectorRef.current;
        const signalsDelivered = await stopDetector.flush();
        if (!signalsDelivered) {
          toast.error('Monitoring events are still queued. Check your connection and submit again.');
          return;
        }
        stopDetectorRef.current = null;
        await stopDetector();
      }
      await endSession(sessionId, answers);
      setSubmitted(true);
      cleanupSession();
      toast.success('Exam submitted successfully');
    } catch (err) {
      toast.error(err?.message || 'Unable to submit your exam');
    } finally {
      setSubmitting(false);
    }
  };

  const startMonitoring = async () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        toast.error('Fullscreen is required to start the exam. Please try again.');
        return;
      }
    }
    if (!document.fullscreenElement) {
      toast.error('Fullscreen is required to start the exam. Please try again.');
      return;
    }

    try {
      const session = await startSession(examId, {
        userAgent: navigator.userAgent,
        screen: { w: window.innerWidth, h: window.innerHeight },
      });

      const nextSessionId = session?.sessionId || session?._id || session?.id;
      if (!nextSessionId) throw new Error('No active exam session was returned');

      activeSessionRef.current = true;
      const nextStartedAt = session?.startedAt || new Date().toISOString();
      const startedAtMs = new Date(nextStartedAt).getTime();
      const durationMs = Number(exam.durationMin || 60) * 60 * 1000;
      const durationDeadline = startedAtMs + durationMs;
      const examDeadline = exam.endAt ? new Date(exam.endAt).getTime() : Number.POSITIVE_INFINITY;

      setSessionId(nextSessionId);
      setSessionStartedAt(nextStartedAt);
      setRemainingMs(Math.min(durationDeadline, examDeadline) - Date.now());
      setMonitoringStarted(true);

      const activeFingerprints = fingerprints;

      const socket = createSocket();
      socketRef.current = socket;

      socket.on('connect', () => {
        setSocketConnected(false);
        socket.emit('session:join', { sessionId: nextSessionId }, (ack) => {
          if (!ack?.ok) {
            setSocketConnected(false);
            toast.error(ack?.error || 'Monitoring connection was not confirmed');
            return;
          }
          setSocketConnected(true);
        });
      });
      socket.on('disconnect', () => setSocketConnected(false));
      socket.on('connect_error', () => setSocketConnected(false));

      const stop = startDetector({
        socket,
        sessionId: nextSessionId,
        fingerprints: activeFingerprints,
        onExtensionStatus: setBrowserExtensionConnected,
      });
      stopDetectorRef.current = stop;
    } catch (err) {
      toast.error(err?.message || 'Unable to start the monitored exam');
    }
  };

  const updateAnswer = (questionIndex, value) => {
    setAnswers((current) => ({
      ...current,
      [questionIndex]: value,
    }));
  };

  const timerLabel = useMemo(() => formatTime(remainingMs), [remainingMs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base px-4 py-8 text-text">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-xl bg-slate-700/80" />
          <div className="h-24 rounded-2xl bg-slate-700/80" />
          <div className="h-48 rounded-2xl bg-slate-700/80" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <ErrorState message={error} onRetry={loadExam} />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-base px-4 py-10">
        <div className="mx-auto max-w-xl">
          <EmptyState title="Exam not found" hint="This exam may not be available right now." actionLabel="Back" onAction={() => navigate('/candidate')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-text">
      <Modal
        open={!monitoringStarted && !submitted}
        onClose={closeExamRules}
        title="Before you begin: exam rules"
        description="Please read these instructions before starting. Your exam timer begins when monitoring starts."
        size="md"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <h4 className="font-semibold text-emerald-200">During the exam</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
              <li>Answer the questions independently using your own knowledge.</li>
              <li>Stay on this exam page and keep the exam in fullscreen.</li>
              <li>Use only books, tools, and other materials that the exam instructions explicitly permit.</li>
              <li>If a technical issue occurs or you need to leave the exam page, contact your proctor and explain what happened.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <h4 className="font-semibold text-red-200">Not permitted</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
              <li>Do not open other websites, search engines, messaging apps, or AI answer tools during the exam.</li>
              <li>Do not use unauthorized browser extensions, overlays, helper tools, another person, or another device to get answers.</li>
              <li>Do not copy questions or answers elsewhere, or paste in answers from another source.</li>
            </ul>
          </div>

          <p className="text-sm leading-6 text-slate-300">
            Monitoring can record exam-page focus changes and integrity signals. If the optional browser companion is installed, it can also report the active tab’s title and sanitized URL—not page text. Signals are sent to your assigned proctor for review; a signal by itself is not a decision that you broke the rules.
          </p>

          <div className="flex justify-end">
            <Button
              onClick={startMonitoring}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            >
              I understand — Start exam
            </Button>
          </div>
        </div>
      </Modal>

      {submitted ? (
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
          <Card className="w-full max-w-xl border-emerald-500/40 bg-emerald-500/10 text-center">
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">✓</div>
              <h2 className="text-2xl font-semibold text-white">Exam submitted</h2>
              <p className="text-slate-200">Your answers were recorded successfully. You can return to your dashboard.</p>
              <Button onClick={() => navigate('/candidate')}>Back to My exams</Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-700 bg-surface/70 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Active exam</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{exam.title}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm">
                <span className={['h-2.5 w-2.5 rounded-full', socketConnected ? 'bg-ok' : 'bg-danger'].join(' ')} />
                <span className={socketConnected ? 'text-ok' : 'text-danger'} role="status">
                  {socketConnected ? 'Integrity monitoring active' : 'Live link reconnecting · events queued'}
                </span>
              </div>
              <div
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm',
                  browserExtensionConnected
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                ].join(' ')}
                role="status"
                title="The companion reports active-tab URL/title only; it does not read page text."
              >
                {browserExtensionConnected ? 'Browser companion connected' : 'Tab URL tracking unavailable'}
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-lg font-semibold text-white num">
                {timerLabel}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {exam.questions?.map((question, questionIndex) => {
              const choiceValue = clampToSet(answers[questionIndex]);
              return (
                <Card key={question._id || `${questionIndex}-${question.text}`} className="p-5">
                  <h3 className="mb-4 text-lg font-medium text-white">
                    {questionIndex + 1}. {question.text}
                  </h3>

                  {question.options && question.options.length ? (
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <label key={option} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-slate-200">
                          <input
                            type="radio"
                            name={`question-${questionIndex}`}
                            checked={choiceValue === option}
                            onChange={() => updateAnswer(questionIndex, option)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={choiceValue}
                        onChange={(event) => updateAnswer(questionIndex, event.target.value)}
                        rows={5}
                        className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Type your response here..."
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-700 bg-surface/80 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {fingerprints.length ? (
                <>
                  <Badge tone="LOW">{fingerprints.length} fingerprints loaded</Badge>
                </>
              ) : (
                <Badge tone="MED">Detector fallback active</Badge>
              )}
            </div>

            <Button
              variant="primary"
              loading={submitting}
              onClick={handleSubmit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
              className="min-w-[150px]"
            >
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
