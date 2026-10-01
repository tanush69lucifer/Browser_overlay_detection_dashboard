import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createFingerprint,
  getFingerprints,
  getThresholds,
  updateFingerprint,
  updateThreshold,
} from '../../api/admin';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Skeleton from '../../components/ui/Skeleton';

const EMPTY_FORM = {
  name: '',
  tool: '',
  matcherType: 'SELECTOR',
  matcher: '',
  weight: 10,
  severity: 'HIGH',
  isActive: true,
  allowed: false,
};

const DEFAULT_THRESHOLDS = {
  LOW: { sensitivity: 'LOW', windowMs: 60000, flagScore: 15 },
  MEDIUM: { sensitivity: 'MEDIUM', windowMs: 60000, flagScore: 8 },
  HIGH: { sensitivity: 'HIGH', windowMs: 60000, flagScore: 4 },
};

export default function Fingerprints() {
  const [items, setItems] = useState([]);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState('');

  const loadFingerprints = async () => {
    try {
      setLoading(true);
      setError('');
      const [payload, thresholdPayload] = await Promise.all([getFingerprints(), getThresholds()]);
      const list = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const thresholdList = Array.isArray(thresholdPayload?.items) ? thresholdPayload.items : [];
      setItems(list);
      setThresholds({
        ...DEFAULT_THRESHOLDS,
        ...Object.fromEntries(thresholdList.map((threshold) => [threshold.sensitivity, threshold])),
      });
    } catch (err) {
      setError(err?.message || 'Unable to load fingerprints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFingerprints();
  }, []);

  const openCreate = () => {
    setEditingId('');
    setDraft(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (fingerprint) => {
    setEditingId(fingerprint._id || fingerprint.id);
    setDraft({
      name: fingerprint.name || '',
      tool: fingerprint.tool || '',
      matcherType: fingerprint.matcherType || 'SELECTOR',
      matcher: fingerprint.matcher || '',
      weight: fingerprint.weight || 10,
      severity: fingerprint.severity || 'HIGH',
      isActive: Boolean(fingerprint.isActive),
      allowed: Boolean(fingerprint.allowed),
    });
    setModalOpen(true);
  };

  const saveFingerprint = async () => {
    if (!draft.name || !draft.matcher) {
      toast.error('Name and matcher are required');
      return;
    }

    try {
      setSubmitting(true);
      const fingerprintDraft = draft.allowed ? { ...draft, severity: 'LOW', weight: 1 } : draft;
      if (editingId) {
        await updateFingerprint(editingId, fingerprintDraft);
        toast.success('Fingerprint updated');
      } else {
        await createFingerprint(fingerprintDraft);
        toast.success('Fingerprint created');
      }
      setModalOpen(false);
      setDraft(EMPTY_FORM);
      await loadFingerprints();
    } catch (err) {
      toast.error(err?.message || 'Unable to save fingerprint');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (fingerprint) => {
    try {
      await updateFingerprint(fingerprint._id || fingerprint.id, {
        ...fingerprint,
        isActive: !fingerprint.isActive,
      });
      await loadFingerprints();
    } catch (err) {
      toast.error(err?.message || 'Unable to update fingerprint');
    }
  };

  const toggleAllowed = async (fingerprint) => {
    try {
      const allowed = !fingerprint.allowed;
      await updateFingerprint(fingerprint._id || fingerprint.id, {
        ...fingerprint,
        allowed,
        ...(allowed ? { severity: 'LOW', weight: 1 } : {}),
      });
      await loadFingerprints();
    } catch (err) {
      toast.error(err?.message || 'Unable to update fingerprint');
    }
  };

  const saveThreshold = async (sensitivity) => {
    const threshold = thresholds[sensitivity];
    const windowMs = Number(threshold.windowMs);
    const flagScore = Number(threshold.flagScore);
    if (!Number.isInteger(windowMs) || windowMs < 1000 || !Number.isInteger(flagScore) || flagScore < 1) {
      toast.error('Window must be at least 1 second and score must be a positive integer');
      return;
    }
    try {
      setSavingThreshold(sensitivity);
      const result = await updateThreshold(sensitivity, { windowMs, flagScore });
      setThresholds((current) => ({ ...current, [sensitivity]: result.threshold }));
      toast.success(`${sensitivity} sensitivity threshold saved`);
    } catch (err) {
      toast.error(err?.message || `Unable to save ${sensitivity} sensitivity threshold`);
    } finally {
      setSavingThreshold('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Card className="p-4">
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadFingerprints} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Fingerprints</h1>
        </div>
        <Button onClick={openCreate}>Add fingerprint</Button>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Scoring thresholds</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sensitivity changes scoring cutoffs only; the detector signals stay the same.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {Object.values(thresholds).map((threshold) => (
            <Card key={threshold.sensitivity} className="space-y-4">
              <h3 className="font-semibold text-white">{threshold.sensitivity}</h3>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Scoring window (milliseconds)</span>
                <Input
                  type="number"
                  min="1000"
                  step="1000"
                  value={threshold.windowMs}
                  onChange={(event) => setThresholds((current) => ({
                    ...current,
                    [threshold.sensitivity]: { ...current[threshold.sensitivity], windowMs: event.target.value },
                  }))}
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Flag score threshold</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={threshold.flagScore}
                  onChange={(event) => setThresholds((current) => ({
                    ...current,
                    [threshold.sensitivity]: { ...current[threshold.sensitivity], flagScore: event.target.value },
                  }))}
                />
              </label>
              <Button loading={savingThreshold === threshold.sensitivity} onClick={() => saveThreshold(threshold.sensitivity)}>
                Save {threshold.sensitivity}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {items.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm text-slate-200">
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Tool</th>
                  <th className="px-4 py-3 font-medium">Matcher</th>
                  <th className="px-4 py-3 font-medium">Weight</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3 font-medium">Allowed</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((fingerprint) => (
                  <tr key={fingerprint._id || fingerprint.id} className="bg-surface/40">
                    <td className="px-4 py-3 font-medium text-white">{fingerprint.name}</td>
                    <td className="px-4 py-3">{fingerprint.tool}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{fingerprint.matcher}</td>
                    <td className="px-4 py-3 text-slate-200">{fingerprint.weight}</td>
                    <td className="px-4 py-3">
                      <Badge tone={fingerprint.severity || 'HIGH'}>{fingerprint.severity || 'HIGH'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant={fingerprint.isActive ? 'primary' : 'ghost'} onClick={() => toggleActive(fingerprint)}>
                        {fingerprint.isActive ? 'On' : 'Off'}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant={fingerprint.allowed ? 'ghost' : 'primary'} onClick={() => toggleAllowed(fingerprint)}>
                        {fingerprint.allowed ? 'Allowed' : 'Blocked'}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" onClick={() => openEdit(fingerprint)}>
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
          title="No fingerprints configured"
          hint="Add browser or extension fingerprints to detect known overlay tooling."
          actionLabel="Add fingerprint"
          onAction={openCreate}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit fingerprint' : 'Add fingerprint'} size="md">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            <Input label="Tool" value={draft.tool} onChange={(event) => setDraft((current) => ({ ...current, tool: event.target.value }))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Matcher type"
              value={draft.matcherType}
              onChange={(event) => setDraft((current) => ({ ...current, matcherType: event.target.value }))}
              options={[
                { value: 'SELECTOR', label: 'SELECTOR' },
                { value: 'IFRAME_SRC', label: 'IFRAME_SRC' },
                { value: 'GLOBAL_VAR', label: 'GLOBAL_VAR' },
              ]}
            />
            {draft.allowed ? <p className="text-xs text-slate-400">Allowed tools are retained as fingerprint evidence and scored LOW at weight 1.</p> : null}
            <Input label="Weight" type="number" value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: Number(event.target.value) || 10 }))} />
          </div>

          <Input
            label="Matcher"
            value={draft.matcher}
            onChange={(event) => setDraft((current) => ({ ...current, matcher: event.target.value }))}
          />

          <Select
            label="Severity"
            value={draft.severity}
            onChange={(event) => setDraft((current) => ({ ...current, severity: event.target.value }))}
            options={[
              { value: 'LOW', label: 'LOW' },
              { value: 'MED', label: 'MED' },
              { value: 'HIGH', label: 'HIGH' },
            ]}
          />

          <div className="flex gap-3">
            <Button variant={draft.isActive ? 'primary' : 'ghost'} onClick={() => setDraft((current) => ({ ...current, isActive: !current.isActive }))}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </Button>
            <Button variant={draft.allowed ? 'ghost' : 'primary'} onClick={() => setDraft((current) => ({ ...current, allowed: !current.allowed }))}>
              {draft.allowed ? 'Allowed' : 'Blocked'}
            </Button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={submitting} onClick={saveFingerprint}>
              {editingId ? 'Save changes' : 'Create fingerprint'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
