import { useState } from 'react';
import { useReagents, useCreateReagent, useUpdateReagent, useRemoveReagent, useInstruments } from '../hooks/useData';
import { validateForm, reagentFormSchema, type ReagentFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { Reagent, ReagentCategory, ReagentStatus } from '../types';
import { FlaskConical, Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';

const CATEGORY_OPTIONS: { value: ReagentCategory; label: string }[] = [
  { value: 'reagent', label: 'Reagent' },
  { value: 'control', label: 'Control' },
  { value: 'calibrator', label: 'Calibrator' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'kit', label: 'Kit' },
];

const STATUS_OPTIONS: { value: ReagentStatus; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'expired', label: 'Expired' },
  { value: 'on_order', label: 'On Order' },
];

const STATUS_BADGE: Record<ReagentStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  in_stock: 'success',
  low_stock: 'warning',
  expired: 'danger',
  on_order: 'secondary',
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'expired', label: 'Expired' },
  { value: 'on_order', label: 'On Order' },
];

const INIT: ReagentFormData = {
  name: '',
  catalogNumber: '',
  lotNumber: '',
  manufacturer: '',
  category: 'reagent' as ReagentCategory,
  quantityOnHand: 0,
  unit: '',
  reorderPoint: 0,
  expirationDate: '',
  storageLocation: '',
  instrumentId: '',
  status: 'in_stock' as ReagentStatus,
};

function isNearExpiry(expirationDate: string): boolean {
  if (!expirationDate) return false;
  const expDate = new Date(`${expirationDate}T00:00:00`);
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return expDate.getTime() - now.getTime() <= thirtyDaysMs && expDate.getTime() >= now.getTime();
}

export default function Reagents() {
  const { data: reagents = [], isLoading, error } = useReagents();
  const { data: instruments = [] } = useInstruments();
  const createMutation = useCreateReagent();
  const updateMutation = useUpdateReagent();
  const removeMutation = useRemoveReagent();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reagent | null>(null);
  const [formData, setFormData] = useState<ReagentFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof ReagentFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const val = (field === 'quantityOnHand' || field === 'reorderPoint')
      ? (e.target.value === '' ? 0 : Number(e.target.value))
      : e.target.value;
    setFormData((p) => ({ ...p, [field]: val }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData(INIT); setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (r: Reagent) => {
    setEditing(r);
    setFormData({
      name: r.name,
      catalogNumber: r.catalogNumber ?? '',
      lotNumber: r.lotNumber,
      manufacturer: r.manufacturer ?? '',
      category: r.category,
      quantityOnHand: r.quantityOnHand,
      unit: r.unit,
      reorderPoint: r.reorderPoint,
      expirationDate: r.expirationDate,
      storageLocation: r.storageLocation ?? '',
      instrumentId: r.instrumentId ?? '',
      status: r.status,
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(reagentFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      const payload = {
        ...v.data,
        catalogNumber: v.data.catalogNumber || undefined,
        manufacturer: v.data.manufacturer || undefined,
        storageLocation: v.data.storageLocation || undefined,
        instrumentId: v.data.instrumentId || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast.success('Reagent updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('Reagent created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (r: Reagent) => {
    if (!await confirm({ title: 'Delete reagent', message: `Delete ${r.name} (Lot: ${r.lotNumber})? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(r.id);
      toast.success('Reagent deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = reagents.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || `${r.name} ${r.manufacturer ?? ''} ${r.lotNumber} ${r.catalogNumber ?? ''}`.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const instrumentOptions = [
    { value: '', label: 'No instrument' },
    ...instruments.map((inst) => ({ value: inst.id, label: inst.name })),
  ];

  const getRowClass = (r: Reagent): string => {
    if (r.status === 'expired') return 'border-b border-border transition-colors last:border-0 bg-danger/10';
    if (r.status === 'low_stock') return 'border-b border-border transition-colors last:border-0 bg-warning/10';
    return 'border-b border-border hover:bg-card-hover transition-colors last:border-0';
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reagents</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{reagents.length} reagent{reagents.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Reagent</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, manufacturer, lot, or catalog number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="w-10 h-10" />}
            title="No reagents found"
            description={search || statusFilter ? 'Try adjusting your search or filter.' : 'Add your first reagent to get started.'}
            action={!search && !statusFilter ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Reagent</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Name / Lot</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Quantity</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Expiration</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={getRowClass(r)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-foreground-muted">Lot: {r.lotNumber}{r.catalogNumber ? ` · Cat: ${r.catalogNumber}` : ''}</div>
                      {r.manufacturer && <div className="text-xs text-foreground-muted">{r.manufacturer}</div>}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden sm:table-cell">{formatStatus(r.category)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{r.quantityOnHand} {r.unit}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span className="text-foreground-muted">{formatDate(r.expirationDate)}</span>
                        {isNearExpiry(r.expirationDate) && (
                          <span title="Expires within 30 days">
                            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[r.status]} size="sm">{formatStatus(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        title={editing ? 'Edit Reagent' : 'New Reagent'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Reagent'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name" value={formData.name} onChange={f('name')} required error={formErrors.name} />
            <Input label="Lot Number" value={formData.lotNumber} onChange={f('lotNumber')} required error={formErrors.lotNumber} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Catalog Number" value={formData.catalogNumber ?? ''} onChange={f('catalogNumber')} error={formErrors.catalogNumber} />
            <Input label="Manufacturer" value={formData.manufacturer ?? ''} onChange={f('manufacturer')} error={formErrors.manufacturer} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Category" value={formData.category} onChange={f('category')} options={CATEGORY_OPTIONS} required error={formErrors.category} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Quantity on Hand" type="number" value={String(formData.quantityOnHand)} onChange={f('quantityOnHand')} required error={formErrors.quantityOnHand} />
            <Input label="Unit" value={formData.unit} onChange={f('unit')} required placeholder="e.g. mL, tests, vials" error={formErrors.unit} />
            <Input label="Reorder Point" type="number" value={String(formData.reorderPoint)} onChange={f('reorderPoint')} required error={formErrors.reorderPoint} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Expiration Date" type="date" value={formData.expirationDate} onChange={f('expirationDate')} required error={formErrors.expirationDate} />
            <Input label="Storage Location" value={formData.storageLocation ?? ''} onChange={f('storageLocation')} placeholder="e.g. Refrigerator A, Shelf 2" error={formErrors.storageLocation} />
          </div>
          <Select
            label="Instrument (optional)"
            value={formData.instrumentId ?? ''}
            onChange={f('instrumentId')}
            options={instrumentOptions}
            error={formErrors.instrumentId}
          />
        </div>
      </Modal>
    </div>
  );
}
