import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createCandidate, createExam, createProctor, getFingerprints, getUsers, updateExam } from '../../api/admin';
import { getExam, getExams } from '../../api/exams';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';
import { DEFAULT_FINGERPRINTS } from '../../detector/config';

const EMPTY_FORM = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  durationMin: 60,
  sensitivity: 'MEDIUM',
  candidateIds: [],
  proctorIds: [],
  fingerprintIds: [],
  questions: [{ text: '', options: [''] }],
};

const toLocalDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const normalizePayload = (draft) => {
  const questions = (draft.questions || [])
    .filter((q) => q.text && q.text.trim())
    .map((q) => ({
      text: q.text,
      options: (q.options || []).filter(Boolean).map((option) => option.trim()),
    }));

  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    startAt: draft.startAt ? new Date(draft.startAt).toISOString() : '',
    endAt: draft.endAt ? new Date(draft.endAt).toISOString() : '',
    durationMin: Number(draft.durationMin || 60),
    questions,
  };
};

const mergeUsers = (current, incoming) => {
  const usersById = new Map(current.map((user) => [String(user._id || user.id), user]));
  for (const user of incoming) usersById.set(String(user._id || user.id), user);
  return [...usersById.values()];
};

export default function AdminExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [proctors, setProctors] = useState([]);
  const [fingerprints, setFingerprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [proctorModalOpen, setProctorModalOpen] = useState(false);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateDraft, setCandidateDraft] = useState({ name: '', email: '', password: '' });
  const [proctorDraft, setProctorDraft] = useState({ name: '', email: '', password: '' });
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [creatingProctor, setCreatingProctor] = useState(false);
  const [creatingCandidate, setCreatingCandidate] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [proctorSearch, setProctorSearch] = useState('');
  const [fingerprintSearch, setFingerprintSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const [examResult, candidateResult, proctorResult, fingerprintResult] = await Promise.all([
        getExams({ page: 1, limit: 100 }),
        getUsers({ role: 'CANDIDATE', page: 1, limit: 100 }),
        getUsers({ role: 'PROCTOR', page: 1, limit: 100 }),
        getFingerprints({ page: 1, limit: 500 }),
      ]);

      const examList = Array.isArray(examResult?.items) ? examResult.items : Array.isArray(examResult) ? examResult : [];
      setExams(examList);
      setCandidates(Array.isArray(candidateResult?.items) ? candidateResult.items : Array.isArray(candidateResult) ? candidateResult : []);
      setProctors(Array.isArray(proctorResult?.items) ? proctorResult.items : Array.isArray(proctorResult) ? proctorResult : []);
      setFingerprints(Array.isArray(fingerprintResult?.items) ? fingerprintResult.items : []);
    } catch (err) {
      setFetchError(err?.message || 'Unable to load the exam dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [candidateResult, proctorResult] = await Promise.all([
          getUsers({ role: 'CANDIDATE', page: 1, limit: 100, search: candidateSearch }),
          getUsers({ role: 'PROCTOR', page: 1, limit: 100, search: proctorSearch }),
        ]);
        if (cancelled) return;
        const candidateItems = Array.isArray(candidateResult?.items) ? candidateResult.items : [];
        const proctorItems = Array.isArray(proctorResult?.items) ? proctorResult.items : [];
        setCandidates((current) => mergeUsers(current, candidateItems));
        setProctors((current) => mergeUsers(current, proctorItems));
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Unable to search assigned users');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [candidateSearch, proctorSearch]);

  const filteredCandidates = useMemo(
    () =>
      candidates.filter((user) =>
        !candidateSearch || `${user.name} ${user.email}`.toLowerCase().includes(candidateSearch.toLowerCase())
      ),
    [candidateSearch, candidates]
  );

  const filteredProctors = useMemo(
    () =>
      proctors.filter((user) =>
        !proctorSearch || `${user.name} ${user.email}`.toLowerCase().includes(proctorSearch.toLowerCase())
      ),
    [proctorSearch, proctors]
  );
  const filteredFingerprints = useMemo(
    () =>
      fingerprints.filter((fingerprint) =>
        !fingerprintSearch || `${fingerprint.name} ${fingerprint.tool}`.toLowerCase().includes(fingerprintSearch.toLowerCase())
      ),
    [fingerprintSearch, fingerprints]
  );
  const examWindowMs = draft.startAt && draft.endAt
    ? new Date(draft.endAt).getTime() - new Date(draft.startAt).getTime()
    : NaN;
  const examWindowMinutes = Number.isFinite(examWindowMs) && examWindowMs > 0
    ? Math.floor(examWindowMs / 60_000)
    : null;

  const openCreateModal = () => {
    setDraft(EMPTY_FORM);
    setEditingId('');
    setModalOpen(true);
  };

  const openEditModal = async (exam) => {
    try {
      const payload = await getExam(exam._id || exam.id);
      const details = payload?.exam || payload;
      setEditingId(details._id || details.id);
      setCandidates((current) => mergeUsers(current, details.candidates || []));
      setProctors((current) => mergeUsers(current, details.proctors || []));
    setDraft({
      title: details.title || '',
      description: details.description || '',
      startAt: toLocalDateTimeInput(details.startAt),
      endAt: toLocalDateTimeInput(details.endAt),
      durationMin: details.durationMin || 60,
      sensitivity: details.sensitivity || 'MEDIUM',
      candidateIds: (details.candidateIds || details.candidates?.map((user) => user._id) || []).map((id) => String(id)),
      proctorIds: (details.proctorIds || details.proctors?.map((user) => user._id) || []).map((id) => String(id)),
      fingerprintIds: (details.fingerprintIds || []).map((id) => String(id)),
      questions: (details.questions || []).map((question) => ({
        text: question.text || '',
        options: Array.isArray(question.options) ? question.options : [],
      })),
    });
      setModalOpen(true);
    } catch (err) {
      toast.error(err?.message || 'Unable to load exam for editing');
    }
  };

  const toggleSelection = (field, userId) => {
    setDraft((current) => {
      const selected = current[field] || [];
      return {
        ...current,
        [field]: selected.includes(userId)
          ? selected.filter((id) => id !== userId)
          : [...selected, userId],
      };
    });
  };

  const toggleFingerprint = (fingerprintId) => {
    const activeIds = fingerprints
      .filter((fingerprint) => fingerprint.isActive)
      .map((fingerprint) => String(fingerprint._id || fingerprint.id));
    setDraft((current) => {
      const selectedIds = current.fingerprintIds.length
        ? current.fingerprintIds
        : activeIds;
      const nextIds = selectedIds.includes(fingerprintId)
        ? selectedIds.filter((id) => id !== fingerprintId)
        : [...selectedIds, fingerprintId];
      return {
        ...current,
        fingerprintIds: nextIds.length === activeIds.length ? [] : nextIds,
      };
    });
  };

  const updateQuestion = (index, field, value) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [field]: value } : question
      ),
    }));
  };

  const addQuestion = () => {
    setDraft((current) => ({
      ...current,
      questions: [...current.questions, { text: '', options: [''] }],
    }));
  };

  const removeQuestion = (index) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.filter((_, idx) => idx !== index),
    }));
  };

  const saveExam = async () => {
    const payload = normalizePayload(draft);
    if (!payload.title) {
      toast.error('Exam title is required');
      return;
    }
    if (!payload.startAt || !payload.endAt) {
      toast.error('Start and end times are required');
      return;
    }
    if (new Date(payload.endAt) <= new Date(payload.startAt)) {
      toast.error('End time must be after the start time');
      return;
    }
    if (!Number.isInteger(payload.durationMin) || payload.durationMin < 1 || payload.durationMin > 600) {
      toast.error('Exam duration must be from 1 to 600 minutes');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await updateExam(editingId, payload);
        toast.success('Exam updated');
      } else {
        await createExam(payload);
        toast.success('Exam created');
      }
      setModalOpen(false);
      setDraft(EMPTY_FORM);
      await loadData();
    } catch (err) {
      const details = err?.details || err?.message || 'Unable to save the exam';
      toast.error(details);
    } finally {
      setSubmitting(false);
    }
  };

  const saveProctor = async () => {
    const name = proctorDraft.name.trim();
    const email = proctorDraft.email.trim();
    if (name.length < 2 || !email || proctorDraft.password.length < 8) {
      toast.error('Enter a name, valid email, and password of at least 8 characters');
      return;
    }

    try {
      setCreatingProctor(true);
      const result = await createProctor({ name, email, password: proctorDraft.password });
      const createdUser = result?.user;
      if (!createdUser?._id) throw new Error('Proctor account was created, but the user details were not returned');
      setProctors((current) => mergeUsers(current, [createdUser]));
      setProctorDraft({ name: '', email: '', password: '' });
      setProctorModalOpen(false);
      toast.success('Proctor account created and added to the assignment list');
    } catch (err) {
      toast.error(err?.message || 'Unable to create proctor account');
    } finally {
      setCreatingProctor(false);
    }
  };

  const saveCandidate = async () => {
    const name = candidateDraft.name.trim();
    const email = candidateDraft.email.trim();
    if (name.length < 2 || !email || candidateDraft.password.length < 8) {
      toast.error('Enter a name, valid email, and password of at least 8 characters');
      return;
    }

    try {
      setCreatingCandidate(true);
      const result = await createCandidate({ name, email, password: candidateDraft.password });
      const createdUser = result?.user;
      if (!createdUser?._id) throw new Error('Candidate account was created, but the user details were not returned');
      setCandidates((current) => mergeUsers(current, [createdUser]));
      setCandidateDraft({ name: '', email: '', password: '' });
      setCandidateModalOpen(false);
      toast.success('Candidate account created and added to the assignment list');
    } catch (err) {
      toast.error(err?.message || 'Unable to create candidate account');
    } finally {
      setCreatingCandidate(false);
    }
  };

  const renderAssignmentPicker = (title, items, selectedIds, search, setSearch, field) => (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-white">{title}</h4>
        <span className="text-xs text-slate-400">{selectedIds.length} selected</span>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={`Search ${title.toLowerCase()}`}
      />

      <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
        {items.length ? (
          items.map((user) => {
            const active = selectedIds.includes(String(user._id || user.id));
            return (
              <button
                type="button"
                key={user._id || user.id}
                onClick={() => toggleSelection(field, String(user._id || user.id))}
                className={[
                  'min-w-36 rounded-xl border px-2.5 py-2 text-left text-xs transition',
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600 bg-slate-900/60 text-slate-200',
                ].join(' ')}
              >
                <span className="block font-medium">{user.name}</span>
                {user.email ? <span className="mt-1 block break-all text-[10px] text-slate-400">{user.email}</span> : null}
              </button>
            );
          })
        ) : (
          <span className="text-xs text-slate-400">No matches</span>
        )}
      </div>
    </div>
  );

  const renderFingerprintPicker = () => (
    <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
        <h4 className="font-medium text-white">Detection checks</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Built-in checks are always on. Choose which active configured fingerprints apply to this exam.
        </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="shrink-0 px-3 py-2 text-xs"
          onClick={() => setDraft((current) => ({ ...current, fingerprintIds: [] }))}
        >
          Select all active
        </Button>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">Built-in checks · always on</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_FINGERPRINTS.map((fingerprint) => (
            <Badge key={fingerprint.tool} tone="INFO">{fingerprint.tool.replaceAll('_', ' ')}</Badge>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Configured fingerprints</p>
          <span className="text-xs text-slate-400">
            {draft.fingerprintIds.length === 0
              ? `${fingerprints.filter((item) => item.isActive).length} active · all selected`
              : `${draft.fingerprintIds.length} selected`}
          </span>
        </div>
        <Input
          value={fingerprintSearch}
          onChange={(event) => setFingerprintSearch(event.target.value)}
          placeholder="Search configured fingerprints"
        />
        <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">
          {filteredFingerprints.length ? filteredFingerprints.map((fingerprint) => {
            const id = String(fingerprint._id || fingerprint.id);
            const selected = draft.fingerprintIds.length === 0
              ? fingerprint.isActive
              : draft.fingerprintIds.includes(id);
            const severityTone = fingerprint.allowed ? 'LOW' : fingerprint.severity;
            return (
              <button
                type="button"
                key={id}
                aria-pressed={selected}
                disabled={!fingerprint.isActive && !draft.fingerprintIds.includes(id)}
                onClick={() => toggleFingerprint(id)}
                className={[
                  'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  selected
                    ? 'border-primary/70 bg-primary/15 text-white'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500',
                  !fingerprint.isActive ? 'cursor-not-allowed opacity-45' : '',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold',
                    selected ? 'border-primary bg-primary text-white' : 'border-slate-500 text-transparent',
                  ].join(' ')}
                >
                  ✓
                </span>
                <span>{fingerprint.name}</span>
                <Badge tone={severityTone}>{fingerprint.allowed ? 'Allowed' : fingerprint.severity}</Badge>
                {!fingerprint.isActive ? <span className="text-slate-500">Inactive</span> : null}
              </button>
            );
          }) : <span className="text-xs text-slate-400">No configured fingerprints match. Built-in checks remain on.</span>}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card className="p-4">
          <Skeleton className="h-12 w-full" />
        </Card>
        <Card className="p-4">
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    );
  }

  if (fetchError) {
    return <ErrorState message={fetchError} onRetry={loadData} />;
  }

  const now = Date.now();
  const liveExamCount = exams.filter((exam) => now >= new Date(exam.startAt).getTime() && now <= new Date(exam.endAt).getTime()).length;
  const upcomingExamCount = exams.filter((exam) => now < new Date(exam.startAt).getTime()).length;
  const completedExamCount = exams.length - liveExamCount - upcomingExamCount;

  return (
    <div className="relative z-10 space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Admin workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Exam timeline</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Create assessments, assign people, and manage scheduled exam windows.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => setCandidateModalOpen(true)}>Add candidate</Button>
          <Button variant="ghost" onClick={() => setProctorModalOpen(true)}>Add proctor</Button>
          <Button onClick={openCreateModal}>+ Create exam</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Live now', value: liveExamCount, tone: 'OK', marker: 'bg-ok' },
          { label: 'Upcoming', value: upcomingExamCount, tone: 'INFO', marker: 'bg-info' },
          { label: 'Completed', value: completedExamCount, tone: 'NEUTRAL', marker: 'bg-slate-500' },
        ].map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <span className={`absolute inset-y-0 left-0 w-1 ${stat.marker}`} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white num">{stat.value}</p>
              </div>
              <Badge tone={stat.tone}>{stat.label}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {exams.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm text-slate-200">
              <thead className="sticky top-0 bg-slate-900/95 text-slate-300 backdrop-blur">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                  <th className="px-4 py-3 font-medium">Sensitivity</th>
                  <th className="px-4 py-3 font-medium">Candidates</th>
                  <th className="px-4 py-3 font-medium">Proctors</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {exams.map((exam) => (
                  <tr key={exam._id || exam.id} className="bg-surface/40 transition-colors hover:bg-slate-800/60">
                    <td className="px-4 py-3 font-medium text-white">{exam.title}</td>
                    <td className="px-4 py-3">
                      <div>{exam.startAt ? new Date(exam.startAt).toLocaleString() : '—'}</div>
                      <div className="text-slate-400">to {exam.endAt ? new Date(exam.endAt).toLocaleString() : '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={(exam.sensitivity || 'MEDIUM').toUpperCase() === 'HIGH' ? 'HIGH' : (exam.sensitivity || 'MEDIUM').toUpperCase() === 'LOW' ? 'LOW' : 'MED'}>
                        {exam.sensitivity || 'MEDIUM'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{exam.candidateCount ?? (exam.candidateIds || []).length}</td>
                    <td className="px-4 py-3">
                      {exam.proctors?.length ? (
                        <div className="space-y-1">
                          {exam.proctors.map((proctor) => (
                            <div key={proctor.id || proctor.email}>
                              <div className="font-medium text-slate-100">{proctor.name}</div>
                              <div className="text-xs text-slate-400">{proctor.email}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {exam.proctorCount ?? (exam.proctorIds || []).length} assigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/admin/exams/${exam._id || exam.id}/report`)}
                      >
                        Report
                      </Button>
                      <Button variant="ghost" onClick={() => openEditModal(exam)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No exams yet"
          hint="Create your first exam to assign candidates, proctors and questions."
          actionLabel="Create exam"
          onAction={openCreateModal}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit exam' : 'Create exam'} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-100">Sensitivity</legend>
              <input
                type="range"
                min="0"
                max="2"
                step="1"
                value={['LOW', 'MEDIUM', 'HIGH'].indexOf(draft.sensitivity)}
                aria-label="Exam sensitivity"
                aria-valuetext={draft.sensitivity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sensitivity: ['LOW', 'MEDIUM', 'HIGH'][Number(event.target.value)],
                  }))
                }
                className="w-full accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className={draft.sensitivity === 'LOW' ? 'text-ok' : ''}>Low</span>
                <span className={draft.sensitivity === 'MEDIUM' ? 'text-warn' : ''}>Medium</span>
                <span className={draft.sensitivity === 'HIGH' ? 'text-danger' : ''}>High</span>
              </div>
            </fieldset>
          </div>

          <Input
            label="Description"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Start time"
              type="datetime-local"
              value={draft.startAt}
              onChange={(event) => setDraft((current) => ({ ...current, startAt: event.target.value }))}
            />
            <Input
              label="End time"
              type="datetime-local"
              value={draft.endAt}
              onChange={(event) => setDraft((current) => ({ ...current, endAt: event.target.value }))}
            />
            <Input
              label="Duration (min)"
              type="number"
              min="15"
              value={draft.durationMin}
              onChange={(event) => setDraft((current) => ({ ...current, durationMin: Number(event.target.value) || 60 }))}
            />
          </div>
          <p className="text-sm text-slate-400">
            {examWindowMinutes === null
              ? 'Availability window is when candidates may start. Duration is each candidate’s timer.'
              : `Availability window: ${Math.floor(examWindowMinutes / 60)}h ${examWindowMinutes % 60}m. Candidate timer: ${draft.durationMin}m from starting; it stops at the exam end time if that comes first.`}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {renderAssignmentPicker('Candidates', filteredCandidates, draft.candidateIds, candidateSearch, setCandidateSearch, 'candidateIds')}
            {renderAssignmentPicker('Proctors', filteredProctors, draft.proctorIds, proctorSearch, setProctorSearch, 'proctorIds')}
          </div>

          {renderFingerprintPicker()}

          <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-medium text-white">Questions</h4>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Add options for a multiple-choice question, or leave options empty for a written response.
                </p>
              </div>
              <Button variant="ghost" onClick={addQuestion}>
                + Add question
              </Button>
            </div>

            {draft.questions.map((question, questionIndex) => (
              <div key={question._id || questionIndex} className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/20">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-xs text-indigo-200">
                      {questionIndex + 1}
                    </span>
                    Question
                  </span>
                  {draft.questions.length > 1 ? (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                      onClick={() => removeQuestion(questionIndex)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <textarea
                  value={question.text}
                  onChange={(event) => updateQuestion(questionIndex, 'text', event.target.value)}
                  rows={3}
                  aria-label={`Question ${questionIndex + 1} text`}
                  className="w-full resize-y rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-3 text-sm leading-6 text-text placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Write the question or problem statement..."
                />

                <div className="mt-3">
                  <label htmlFor={`question-options-${questionIndex}`} className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                    Answer options <span className="font-normal normal-case tracking-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id={`question-options-${questionIndex}`}
                    value={(question.options || []).join(', ')}
                    onChange={(event) =>
                      updateQuestion(questionIndex, 'options', event.target.value.split(',').map((option) => option.trim()))
                    }
                    rows={2}
                    className="w-full resize-y rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm text-text placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Example: Option A, Option B, Option C"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">Leave this blank when candidates should type a written answer, including code.</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={submitting}
              onClick={saveExam}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            >
              {editingId ? 'Save changes' : 'Create exam'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={proctorModalOpen}
        onClose={() => setProctorModalOpen(false)}
        title="Create proctor account"
        description="Only an Admin can create proctor accounts. The new account will be available for exam assignment."
        size="md"
      >
        <form
          className="space-y-4"
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            saveProctor();
          }}
        >
          <Input
            label="Name"
            autoComplete="name"
            required
            minLength={2}
            value={proctorDraft.name}
            onChange={(event) => setProctorDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={proctorDraft.email}
            onChange={(event) => setProctorDraft((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            label="Temporary password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={proctorDraft.password}
            onChange={(event) => setProctorDraft((current) => ({ ...current, password: event.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setProctorModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creatingProctor}>Create proctor</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={candidateModalOpen}
        onClose={() => setCandidateModalOpen(false)}
        title="Create candidate account"
        description="Create a candidate login and add the account to the candidate assignment list."
        size="md"
      >
        <form
          className="space-y-4"
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            saveCandidate();
          }}
        >
          <Input
            label="Name"
            autoComplete="name"
            required
            minLength={2}
            value={candidateDraft.name}
            onChange={(event) => setCandidateDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={candidateDraft.email}
            onChange={(event) => setCandidateDraft((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            label="Temporary password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={candidateDraft.password}
            onChange={(event) => setCandidateDraft((current) => ({ ...current, password: event.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCandidateModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creatingCandidate}>Create candidate</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
