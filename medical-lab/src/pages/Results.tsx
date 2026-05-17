import { useState } from 'react';
import {
  useResults, useCreateResult, useUpdateResult, useRemoveResult,
  useOrders, usePatients, useSpecimens, useTestCatalog, useInstruments,
} from '../hooks/useData';
import { validateForm, testResultFormSchema, type TestResultFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { TestResult, ResultFlag, ResultStatus } from '../types';
import { TestTube, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const FLAG_OPTIONS: { value: ResultFlag; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'critical_low', label: 'Critical Low' },
  { value: 'critical_high', label: 'Critical High' },
  { value: 'abnormal', label: 'Abnormal' },
];

const STATUS_OPTIONS: { value: ResultStatus; label: string }[] = [
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'amended', label: 'Amended' },
];

const FLAG_BADGE: Record<ResultFlag, 'success' | 'warning' | 'danger' | 'secondary'> = {
  normal: 'success',
  low: 'warning',
  high: 'warning',
  critical_low: 'danger',
  critical_high: 'danger',
  abnormal: 'warning',
};

const STATUS_BADGE: Record<ResultStatus, 'secondary' | 'warning' | 'success' | 'info'> = {
  preliminary: 'secondary',
  pending_verification: 'warning',
  verified: 'success',
  amended: 'info' as any,
};

function autoFlag(value: string, low?: number, high?: number): ResultFlag {
  const num = parseFloat(value);
  if (isNaN(num) || low === undefined || high === undefined) return 'normal';
  if (num < low * 0.7 || num > high * 1.3) return num < low * 0.7 ? 'critical_low' : 'critical_high';
  if (num < low) return 'low';
  if (num > high) return 'high';
  return 'normal';
}

const INIT: TestResultFormData = {
  orderId: '', orderItemId: '', specimenId: '', testCatalogId: '', patientId: '',
  resultValue: '', unit: '', referenceRange: '', flag: 'normal', status: 'preliminary',
  performedBy: '', verifiedBy: '', resultDate: '', verifiedDate: '', instrumentId: '', notes: '',
};

export default function Results() {
  const { data: results = [], isLoading, error } = useResults();
  const { data: orders = [] } = useOrders();
  const { data: patients = [] } = usePatients();
  const { data: specimens = [] } = useSpecimens();
  const { data: catalog = [] } = useTestCatalog();
  const { data: instruments = [] } = useInstruments();
  const createMutation = useCreateResult();
  const updateMutation = useUpdateResult();
  const removeMutation = useRemoveResult();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TestResult | null>(null);
  const [formData, setFormData] = useState<TestResultFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof TestResultFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const val = e.target.value;
    setFormData((p) => {
      const next = { ...p, [field]: val };
      // Auto-derive flag when value changes and catalog item has numeric ranges
      if (field === 'resultValue' || field === 'testCatalogId') {
        const catItem = catalog.find((c) => c.id === (field === 'testCatalogId' ? val : p.testCatalogId));
        if (catItem) {
          next.flag = autoFlag(field === 'resultValue' ? val : p.resultValue, catItem.referenceRangeLow, catItem.referenceRangeHigh);
          if (catItem.unit) next.unit = catItem.unit;
          const rangeParts = [catItem.referenceRangeLow, catItem.referenceRangeHigh].filter((x) => x !== undefined);
          if (rangeParts.length === 2) next.referenceRange = `${rangeParts[0]}-${rangeParts[1]}`;
          else if (catItem.referenceRangeText) next.referenceRange = catItem.referenceRangeText;
        }
      }
      // Auto-populate patientId from order
      if (field === 'orderId') {
        const ord = orders.find((o) => o.id === val);
        if (ord) next.patientId = ord.patientId;
      }
      return next;
    });
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData({ ...INIT, resultDate: new Date().toISOString().slice(0, 10) });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (r: TestResult) => {
    setEditing(r);
    setFormData({
      orderId: r.orderId, orderItemId: r.orderItemId, specimenId: r.specimenId,
      testCatalogId: r.testCatalogId, patientId: r.patientId,
      resultValue: r.resultValue, unit: r.unit ?? '', referenceRange: r.referenceRange ?? '',
      flag: r.flag, status: r.status, performedBy: r.performedBy ?? '',
      verifiedBy: r.verifiedBy ?? '', resultDate: r.resultDate ?? '',
      verifiedDate: r.verifiedDate ?? '', instrumentId: r.instrumentId ?? '',
      notes: r.notes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(testResultFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: v.data });
        toast.success('Result updated');
      } else {
        await createMutation.mutateAsync(v.data as any);
        toast.success('Result created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (r: TestResult) => {
    if (!await confirm({ title: 'Delete result', message: 'Delete this result? This cannot be undone.', confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(r.id);
      toast.success('Result deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const patientName = (id: string) => { const p = patients.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : '—'; };
  const testName = (id: string) => catalog.find((c) => c.id === id)?.name ?? '—';
  const orderNum = (id: string) => orders.find((o) => o.id === id)?.orderNumber ?? '—';

  const filtered = results.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || testName(r.testCatalogId).toLowerCase().includes(q) || patientName(r.patientId).toLowerCase().includes(q) || orderNum(r.orderId).toLowerCase().includes(q);
    const matchF = !flagFilter || r.flag === flagFilter;
    const matchS = !statusFilter || r.status === statusFilter;
    return matchQ && matchF && matchS;
  });

  // Items for the selected order
  const orderItems = formData.orderId
    ? (orders.find((o) => o.id === formData.orderId)?.items ?? [])
    : [];

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Results</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{results.length} result{results.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Result</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by test, patient, order…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All flags</option>
          {FLAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<TestTube className="w-10 h-10" />}
            title="No results found"
            description="Enter a result when a specimen has been analyzed."
            action={<Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Result</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Test</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Ref Range</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Flag</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3 text-foreground font-medium">{testName(r.testCatalogId)}</td>
                    <td className="px-4 py-3 text-foreground-muted">{patientName(r.patientId)}</td>
                    <td className="px-4 py-3 font-mono text-foreground hidden sm:table-cell">{r.resultValue}{r.unit ? ` ${r.unit}` : ''}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{r.referenceRange || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={FLAG_BADGE[r.flag]} size="sm">{formatStatus(r.flag)}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Badge variant={STATUS_BADGE[r.status]} size="sm">{formatStatus(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{r.resultDate ? formatDate(r.resultDate) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? 'Edit Result' : 'New Result'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Result'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <Select
            label="Order"
            value={formData.orderId}
            onChange={f('orderId')}
            required
            placeholder="Select order…"
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNumber} — ${patientName(o.patientId)}` }))}
            error={formErrors.orderId}
          />
          {orderItems.length > 0 && (
            <Select
              label="Order Item (Test)"
              value={formData.orderItemId}
              onChange={(e) => {
                const item = orderItems.find((it) => it.id === e.target.value);
                if (item) {
                  setFormData((p) => {
                    const cat = catalog.find((c) => c.id === item.testCatalogId);
                    const flag = cat ? autoFlag(p.resultValue, cat.referenceRangeLow, cat.referenceRangeHigh) : p.flag;
                    return {
                      ...p,
                      orderItemId: item.id,
                      testCatalogId: item.testCatalogId,
                      unit: cat?.unit ?? p.unit,
                      referenceRange: cat?.referenceRangeLow !== undefined && cat?.referenceRangeHigh !== undefined
                        ? `${cat.referenceRangeLow}-${cat.referenceRangeHigh}`
                        : cat?.referenceRangeText ?? p.referenceRange,
                      flag,
                    };
                  });
                }
              }}
              placeholder="Select test…"
              options={orderItems.map((it) => ({ value: it.id, label: it.testName }))}
              error={formErrors.orderItemId}
            />
          )}
          <Select
            label="Specimen"
            value={formData.specimenId}
            onChange={f('specimenId')}
            required
            placeholder="Select specimen…"
            options={specimens.filter((s) => !formData.orderId || s.orderId === formData.orderId).map((s) => ({ value: s.id, label: s.accessionNumber }))}
            error={formErrors.specimenId}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Result Value" value={formData.resultValue} onChange={f('resultValue')} required placeholder="e.g. 7.2 or Negative" error={formErrors.resultValue} />
            <Input label="Unit" value={formData.unit ?? ''} onChange={f('unit')} placeholder="g/dL" error={formErrors.unit} />
            <Input label="Reference Range" value={formData.referenceRange ?? ''} onChange={f('referenceRange')} placeholder="4.0-5.5" error={formErrors.referenceRange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Flag" value={formData.flag} onChange={f('flag')} options={FLAG_OPTIONS} required error={formErrors.flag} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Result Date" type="date" value={formData.resultDate ?? ''} onChange={f('resultDate')} error={formErrors.resultDate} />
            <Input label="Verified Date" type="date" value={formData.verifiedDate ?? ''} onChange={f('verifiedDate')} error={formErrors.verifiedDate} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Performed By" value={formData.performedBy ?? ''} onChange={f('performedBy')} error={formErrors.performedBy} />
            <Input label="Verified By" value={formData.verifiedBy ?? ''} onChange={f('verifiedBy')} error={formErrors.verifiedBy} />
          </div>
          <Select
            label="Instrument (optional)"
            value={formData.instrumentId ?? ''}
            onChange={f('instrumentId')}
            placeholder="No instrument"
            options={[{ value: '', label: 'No instrument' }, ...instruments.map((i) => ({ value: i.id, label: i.name }))]}
            error={formErrors.instrumentId}
          />
          <Textarea label="Notes" value={formData.notes ?? ''} onChange={f('notes')} rows={2} error={formErrors.notes} />
        </div>
      </Modal>
    </div>
  );
}
