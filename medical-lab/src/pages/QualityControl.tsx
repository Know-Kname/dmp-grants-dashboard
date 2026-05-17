import { useState } from 'react';
import {
  useQCRuns, useCreateQCRun, useUpdateQCRun, useRemoveQCRun,
  useInstruments, useTestCatalog, useStaff,
} from '../hooks/useData';
import { validateForm, qcRunFormSchema, type QCRunFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { QCRun, QCControlLevel, QCResult } from '../types';
import {
  ClipboardCheck, Plus, Search, Pencil, Trash2,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';

const CONTROL_LEVEL_OPTIONS: { value: QCControlLevel; label: string }[] = [
  { value: 'level_1', label: 'Level 1' },
  { value: 'level_2', label: 'Level 2' },
  { value: 'level_3', label: 'Level 3' },
];

const RESULT_OPTIONS: { value: QCResult; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'warning', label: 'Warning' },
  { value: 'fail', label: 'Fail' },
];

const RESULT_BADGE: Record<QCResult, 'success' | 'warning' | 'danger'> = {
  pass: 'success',
  warning: 'warning',
  fail: 'danger',
};

const NUMERIC_FIELDS = ['measuredValue', 'expectedMean', 'expectedSd'] as const;

function computeZScore(measured: number, mean: number, sd: number): number | null {
  if (!sd || sd === 0) return null;
  return (measured - mean) / sd;
}

function deriveResult(z: number | null): QCResult {
  if (z === null) return 'fail';
  const abs = Math.abs(z);
  if (abs <= 1) return 'pass';
  if (abs <= 2) return 'warning';
  return 'fail';
}

function ZScoreDisplay({ measured, mean, sd }: { measured: number; mean: number; sd: number }) {
  const z = computeZScore(measured, mean, sd);
  if (z === null) return <span className="text-foreground-muted">—</span>;
  const abs = Math.abs(z);
  const colorClass = abs <= 1
    ? 'text-success-600'
    : abs <= 2
    ? 'text-warning-700'
    : 'text-destructive';
  return <span className={`font-mono text-sm ${colorClass}`}>{z.toFixed(2)} σ</span>;
}

function ResultCell({ result }: { result: QCResult }) {
  const Icon = result === 'pass' ? CheckCircle2 : result === 'warning' ? AlertTriangle : XCircle;
  const iconColor = result === 'pass' ? 'text-success-600' : result === 'warning' ? 'text-warning-700' : 'text-destructive';
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
      <Badge variant={RESULT_BADGE[result]} size="sm">{formatStatus(result)}</Badge>
    </div>
  );
}

const today = new Date().toISOString().slice(0, 10);

const INIT: QCRunFormData = {
  instrumentId: '',
  testCatalogId: '',
  controlLevel: 'level_1',
  controlLotNumber: '',
  measuredValue: 0,
  expectedMean: 0,
  expectedSd: 0,
  result: 'pass',
  performedBy: '',
  runDate: today,
  notes: '',
};

export default function QualityControl() {
  const { data: runs = [], isLoading, error } = useQCRuns();
  const { data: instruments = [] } = useInstruments();
  const { data: catalog = [] } = useTestCatalog();
  const { data: staff = [] } = useStaff();

  const createMutation = useCreateQCRun();
  const updateMutation = useUpdateQCRun();
  const removeMutation = useRemoveQCRun();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<QCRun | null>(null);
  const [formData, setFormData] = useState<QCRunFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof QCRunFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const val = NUMERIC_FIELDS.includes(field as typeof NUMERIC_FIELDS[number])
      ? (e.target.value === '' ? 0 : Number(e.target.value))
      : e.target.value;
    setFormData((p) => {
      const next = { ...p, [field]: val };
      // Auto-derive result when numeric fields change
      if (NUMERIC_FIELDS.includes(field as typeof NUMERIC_FIELDS[number])) {
        const measured = field === 'measuredValue' ? Number(val) : next.measuredValue;
        const mean = field === 'expectedMean' ? Number(val) : next.expectedMean;
        const sd = field === 'expectedSd' ? Number(val) : next.expectedSd;
        const z = computeZScore(measured, mean, sd);
        next.result = deriveResult(z);
      }
      return next;
    });
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleCalculate = () => {
    const z = computeZScore(formData.measuredValue, formData.expectedMean, formData.expectedSd);
    const derived = deriveResult(z);
    setFormData((p) => ({ ...p, result: derived }));
  };

  const openNew = () => {
    setEditing(null);
    setFormData(INIT);
    setFormErrors({});
    setSubmitError('');
    setShowModal(true);
  };

  const openEdit = (run: QCRun) => {
    setEditing(run);
    setFormData({
      instrumentId: run.instrumentId,
      testCatalogId: run.testCatalogId,
      controlLevel: run.controlLevel,
      controlLotNumber: run.controlLotNumber ?? '',
      measuredValue: run.measuredValue,
      expectedMean: run.expectedMean,
      expectedSd: run.expectedSd,
      result: run.result,
      performedBy: run.performedBy ?? '',
      runDate: run.runDate,
      notes: run.notes ?? '',
    });
    setFormErrors({});
    setSubmitError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const handleSubmit = async () => {
    const v = validateForm(qcRunFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      const payload = {
        ...v.data,
        controlLotNumber: v.data.controlLotNumber || undefined,
        performedBy: v.data.performedBy || undefined,
        notes: v.data.notes || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast.success('QC run updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('QC run created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (run: QCRun) => {
    const instrument = instruments.find((i) => i.id === run.instrumentId);
    const test = catalog.find((t) => t.id === run.testCatalogId);
    const label = [instrument?.name, test?.name].filter(Boolean).join(' / ') || run.id.slice(0, 8);
    if (!await confirm({
      title: 'Delete QC Run',
      message: `Delete the QC run for "${label}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })) return;
    try {
      await removeMutation.mutateAsync(run.id);
      toast.success('QC run deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = runs.filter((r) => {
    if (instrumentFilter && r.instrumentId !== instrumentFilter) return false;
    if (resultFilter && r.result !== resultFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const instrument = instruments.find((i) => i.id === r.instrumentId);
      const test = catalog.find((t) => t.id === r.testCatalogId);
      const staffMember = staff.find((s) => s.id === r.performedBy);
      const haystack = [
        instrument?.name,
        test?.name,
        r.controlLotNumber,
        staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : '',
        r.runDate,
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const instrumentFilterOptions = [
    { value: '', label: 'All Instruments' },
    ...instruments.map((i) => ({ value: i.id, label: i.name })),
  ];

  const resultFilterOptions = [
    { value: '', label: 'All Results' },
    { value: 'pass', label: 'Pass' },
    { value: 'warning', label: 'Warning' },
    { value: 'fail', label: 'Fail' },
  ];

  const instrumentSelectOptions = instruments.map((i) => ({ value: i.id, label: i.name }));
  const testSelectOptions = catalog.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` }));
  const staffSelectOptions = [
    { value: '', label: 'Unassigned' },
    ...staff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` })),
  ];

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quality Control</h1>
          <p className="text-foreground-muted text-sm mt-0.5">
            {runs.length} QC run{runs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New QC Run</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by instrument, test, lot number, staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={instrumentFilter}
          onChange={(e) => setInstrumentFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-w-[160px]"
        >
          {instrumentFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-w-[130px]"
        >
          {resultFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="w-10 h-10" />}
            title="No QC runs found"
            description={
              search || instrumentFilter || resultFilter
                ? 'Try adjusting your filters.'
                : 'Record your first quality control run to get started.'
            }
            action={
              !search && !instrumentFilter && !resultFilter
                ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New QC Run</Button>
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Instrument</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Test</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Control Level</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Measured / Mean ± SD</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Z-Score</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Result</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Performed By</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => {
                  const instrument = instruments.find((i) => i.id === run.instrumentId);
                  const test = catalog.find((t) => t.id === run.testCatalogId);
                  const staffMember = staff.find((s) => s.id === run.performedBy);
                  return (
                    <tr key={run.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {formatDate(run.runDate)}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted hidden sm:table-cell">
                        {instrument?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">
                        {test?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">
                        {formatStatus(run.controlLevel)}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground text-xs whitespace-nowrap">
                        <span className="font-semibold">{run.measuredValue}</span>
                        <span className="text-foreground-muted"> / {run.expectedMean} ± {run.expectedSd}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <ZScoreDisplay
                          measured={run.measuredValue}
                          mean={run.expectedMean}
                          sd={run.expectedSd}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ResultCell result={run.result} />
                      </td>
                      <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">
                        {staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(run)}
                            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(run)}
                            className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? 'Edit QC Run' : 'New QC Run'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>
              {editing ? 'Save Changes' : 'Create QC Run'}
            </Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Instrument"
              value={formData.instrumentId}
              onChange={f('instrumentId')}
              options={instrumentSelectOptions}
              required
              error={formErrors.instrumentId}
            />
            <Select
              label="Test"
              value={formData.testCatalogId}
              onChange={f('testCatalogId')}
              options={testSelectOptions}
              required
              error={formErrors.testCatalogId}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Control Level"
              value={formData.controlLevel}
              onChange={f('controlLevel')}
              options={CONTROL_LEVEL_OPTIONS}
              required
              error={formErrors.controlLevel}
            />
            <Input
              label="Control Lot Number"
              value={formData.controlLotNumber}
              onChange={f('controlLotNumber')}
              placeholder="e.g. LOT-2024-001"
              error={formErrors.controlLotNumber}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Measured Value"
              type="number"
              step="any"
              value={formData.measuredValue === 0 ? '' : formData.measuredValue}
              onChange={f('measuredValue')}
              required
              error={formErrors.measuredValue}
            />
            <Input
              label="Expected Mean"
              type="number"
              step="any"
              value={formData.expectedMean === 0 ? '' : formData.expectedMean}
              onChange={f('expectedMean')}
              required
              error={formErrors.expectedMean}
            />
            <Input
              label="Expected SD"
              type="number"
              step="any"
              value={formData.expectedSd === 0 ? '' : formData.expectedSd}
              onChange={f('expectedSd')}
              required
              error={formErrors.expectedSd}
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Select
                label="Result"
                value={formData.result}
                onChange={f('result')}
                options={RESULT_OPTIONS}
                required
                error={formErrors.result}
              />
            </div>
            <div className="pb-0.5">
              <Button variant="outline" size="sm" onClick={handleCalculate} type="button">
                Calculate
              </Button>
            </div>
            {formData.expectedSd > 0 && (
              <div className="pb-1 text-sm text-foreground-muted whitespace-nowrap">
                z = <ZScoreDisplay
                  measured={formData.measuredValue}
                  mean={formData.expectedMean}
                  sd={formData.expectedSd}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Run Date"
              type="date"
              value={formData.runDate}
              onChange={f('runDate')}
              required
              error={formErrors.runDate}
            />
            <Select
              label="Performed By"
              value={formData.performedBy}
              onChange={f('performedBy')}
              options={staffSelectOptions}
              error={formErrors.performedBy}
            />
          </div>

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={f('notes')}
            rows={3}
            error={formErrors.notes}
          />
        </div>
      </Modal>
    </div>
  );
}
