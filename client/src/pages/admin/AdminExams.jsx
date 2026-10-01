import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createExam, getUsers, updateExam } from '../../api/admin';
import { getExams } from '../../api/exams';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';

const EMPTY_FORM = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  durationMin: 60,
  sensitivity: 'MEDIUM',
  candidateIds: [],
  proctorIds: [],
  questions: [{ text: '', options: [''] }],
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
    durationMin: Number(draft.durationMin || 60),
    questions,
  };
};

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [proctors, setProctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [proctorSearch, setProctorSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const [examResult, candidateResult, proctorResult] = await Promise.all([
        getExams({ page: 1, limit: 100 }),
        getUsers({ role: 'CANDIDATE', page: 1, limit: 100 }),
        getUsers({ role: 'PROCTOR', page: 1, limit: 100 }),
      ]);

      const examList = Array.isArray(examResult?.items) ? examResult.items : Array.isArray(examResult) ? examResult : [];
      setExams(examList);
      setCandidates(Array.isArray(candidateResult?.items) ? candidateResult.items : Array.isArray(candidateResult) ? candidateResult : []);
      setProctors(Array.isArray(proctorResult?.items) ? proctorResult.items : Array.isArray(proctorResult) ? proctorResult : []);
    } catch (err) {
      setFetchError(err?.message || 'Unable to load the exam dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const openCreateModal = () => {
    setDraft(EMPTY_FORM);
    setEditingId('');
    setModalOpen(true);
  };

  const openEditModal = (exam) => {
    setEditingId(exam._id || exam.id);
    setDraft({
      title: exam.title || '',
      description: exam.description || '',
      startAt: exam.startAt ? new Date(exam.startAt).toISOString().slice(0, 16) : '',
      endAt: exam.endAt ? new Date(exam.endAt).toISOString().slice(0, 16) : '',
      durationMin: exam.durationMin || 60,
      sensitivity: exam.sensitivity || 'MEDIUM',
      candidateIds: (exam.candidateIds || []).map((id) => String(id)),
      proctorIds: (exam.proctorIds || []).map((id) => String(id)),
      questions: (exam.questions || []).map((question) => ({
        text: question.text || '',
        options: Array.isArray(question.options) ? question.options : [],
      })),
    });
    setModalOpen(true);
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
                  'rounded-xl border px-2.5 py-2 text-left text-xs transition',
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-slate-600 bg-slate-900/60 text-slate-200',
                ].join(' ')}
              >
                {user.name}
              </button>
            );
          })
        ) : (
          <span className="text-xs text-slate-400">No matches</span>
        )}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Exam timeline</h1>
        </div>
        <Button onClick={openCreateModal}>Create exam</Button>
      </div>

      {exams.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm text-slate-200">
              <thead className="bg-slate-900/80 text-slate-300">
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
                  <tr key={exam._id || exam.id} className="bg-surface/40">
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
                    <td className="px-4 py-3">{(exam.candidateIds || []).length}</td>
                    <td className="px-4 py-3">{(exam.proctorIds || []).length}</td>
                    <td className="px-4 py-3">
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

          <div className="grid gap-4 md:grid-cols-2">
            {renderAssignmentPicker('Candidates', filteredCandidates, draft.candidateIds, candidateSearch, setCandidateSearch, 'candidateIds')}
            {renderAssignmentPicker('Proctors', filteredProctors, draft.proctorIds, proctorSearch, setProctorSearch, 'proctorIds')}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-white">Questions</h4>
              <Button variant="ghost" onClick={addQuestion}>
                Add question
              </Button>
            </div>

            {draft.questions.map((question, questionIndex) => (
              <div key={`${questionIndex}-${question.text}`} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">Question {questionIndex + 1}</span>
                  {draft.questions.length > 1 ? (
                    <button type="button" className="text-xs text-red-300" onClick={() => removeQuestion(questionIndex)}>
                      Remove
                    </button>
                  ) : null}
                </div>

                <Input
                  value={question.text}
                  onChange={(event) => updateQuestion(questionIndex, 'text', event.target.value)}
                  placeholder="Question text"
                />

                <div className="mt-3">
                  <textarea
                    value={(question.options || []).join(', ')}
                    onChange={(event) =>
                      updateQuestion(questionIndex, 'options', event.target.value.split(',').map((option) => option.trim()))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm text-text placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Options separated by commas"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={submitting} onClick={saveExam}>
              {editingId ? 'Save changes' : 'Create exam'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
