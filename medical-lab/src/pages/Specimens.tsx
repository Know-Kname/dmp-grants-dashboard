import { useState } from 'react';
import { useSpecimens, useCreateSpecimen, useUpdateSpecimen, useRemoveSpecimen, useOrders, usePatients } from '../hooks/useData';
import { validateForm, specimenFormSchema, type SpecimenFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { Specimen, SpecimenStatus, SpecimenType, RejectionReason } from '../types';
import { Beaker, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const SPECIMEN_TYPE_OPTIONS: { value: SpecimenType; label: string }[] = [
  { value: 'blood', label: 'Blood' }, { value: 'serum', label: 'Serum' },
  { value: 'plasma', label: 'Plasma' }, { value: 'urine', label: 'Urine' },
  { value: 'stool', label: 'Stool' }, { value: 'swab', label: 'Swab' },
  { value: 'csf', label: 'CSF' }, { value: 'tissue', label: 'Tissue' },
  { value: 'sputum', label: 'Sputum' }, { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: { value: SpecimenStatus; label: string }[] = [
  { value: 'pending_collection', label: 'Pending Collection' },
  { value: 'collected', label: 'Collected' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received', label: 'Received' },
  { value: 'stored', label: 'Stored' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'disposed', label: 'Disposed' },
];

const REJECTION_OPTIONS: { value: RejectionReason; label: string }[] = [
  { value: 'hemolyzed', label: 'Hemolyzed' },
  { value: 'insufficient_volume', label: 'Insufficient Volume' },
  { value: 'clotted', label: 'Clotted' },
  { value: 'mislabeled', label: 'Mislabeled' },
  { value: 'contaminated', label: 'Contaminated' },
  { value: 'expired', label: 'Expired' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE: Record<SpecimenStatus, 'secondary' | 'info' | 'warning' | 'success' | 'danger'> = {
  pending_collection: 'secondary',
  collected: 'info',
  in_transit: 'info',
  received: 'primary' as any,
  stored: 'success',
  rejected: 'danger',
  disposed: 'secondary',
};

const INIT: SpecimenFormData = {
  accessionNumber: '', orderId: '', specimenType: 'blood', status: 'pending_collection',
  collectedBy: '', collectionDate: '', receivedDate: '', storageLocation: '',
  rejectionReason: '', rejectionNotes: '',
};

function nextAccession(specimens: Specimen[]): string {
  const nums = specimens.map((s) => parseInt(s.accessionNumber.replace(/\D/g, '') || '0', 10));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `ACC-${new Date().getFullYear()}-${next}`;
}

export default function Specimens() {
  const { data: specimens = [], isLoading, error } = useSpecimens();
  const { data: orders = [] } = useOrders();
  const { data: patients = [] } = usePatients();
  const createMutation = useCreateSpecimen();
  const updateMutation = useUpdateSpecimen();
  const removeMutation = useRemoveSpecimen();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Specimen | null>(null);
  const [formData, setFormData] = useState<SpecimenFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof SpecimenFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null);
    setFormData({ ...INIT, accessionNumber: nextAccession(specimens) });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (s: Specimen) => {
    setEditing(s);
    setFormData({
      accessionNumber: s.accessionNumber, orderId: s.orderId, specimenType: s.specimenType,
      status: s.status, collectedBy: s.collectedBy ?? '', collectionDate: s.collectionDate ?? '',
      receivedDate: s.receivedDate ?? '', storageLocation: s.storageLocation ?? '',
      rejectionReason: s.rejectionReason ?? '', rejectionNotes: s.rejectionNotes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(specimenFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    const order = orders.find((o) => o.id === formData.orderId);
    const patientId = order?.patientId ?? '';
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: { ...v.data, patientId } as any });
        toast.success('Specimen updated');
      } else {
        await createMutation.mutateAsync({ ...v.data, patientId } as any);
        toast.success('Specimen created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (s: Specimen) => {
    if (!await confirm({ title: 'Delete specimen', message: `Delete ${s.accessionNumber}?`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(s.id);
      toast.success('Specimen deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const orderLabel = (id: string) => orders.find((o) => o.id === id)?.orderNumber ?? '—';
  const patientName = (id: string) => { const p = patients.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : '—'; };

  const filtered = specimens.filter((s) => {
    const q = search.toLowerCase();
    const matchQ = !q || s.accessionNumber.toLowerCase().includes(q) || patientName(s.patientId).toLowerCase().includes(q);
    const matchS = !statusFilter || s.status === statusFilter;
    return matchQ && matchS;
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const showRejection = formData.status === 'rejected';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Specimens</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{specimens.length} specimen{specimens.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Specimen</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by accession or patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
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
            icon={<Beaker className="w-10 h-10" />}
            title="No specimens found"
            description="Create a specimen record to start tracking."
            action={<Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Specimen</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Accession #</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Collected</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{s.accessionNumber}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{orderLabel(s.orderId)}</td>
                    <td className="px-4 py-3 text-foreground">{patientName(s.patientId)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="secondary" size="sm">{formatStatus(s.specimenType)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[s.status]} size="sm">{formatStatus(s.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{s.collectionDate ? formatDate(s.collectionDate) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors"><Trash2 className="w-4 h-4" /></button>
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
        title={editing ? 'Edit Specimen' : 'New Specimen'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Specimen'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Accession #" value={formData.accessionNumber} onChange={f('accessionNumber')} required error={formErrors.accessionNumber} />
            <Select label="Specimen Type" value={formData.specimenType} onChange={f('specimenType')} options={SPECIMEN_TYPE_OPTIONS} required error={formErrors.specimenType} />
          </div>
          <Select
            label="Order"
            value={formData.orderId}
            onChange={f('orderId')}
            required
            placeholder="Select order…"
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNumber} — ${patientName(o.patientId)}` }))}
            error={formErrors.orderId}
          />
          <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required error={formErrors.status} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Collection Date" type="date" value={formData.collectionDate ?? ''} onChange={f('collectionDate')} error={formErrors.collectionDate} />
            <Input label="Received Date" type="date" value={formData.receivedDate ?? ''} onChange={f('receivedDate')} error={formErrors.receivedDate} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Collected By" value={formData.collectedBy ?? ''} onChange={f('collectedBy')} placeholder="Staff member" error={formErrors.collectedBy} />
            <Input label="Storage Location" value={formData.storageLocation ?? ''} onChange={f('storageLocation')} error={formErrors.storageLocation} />
          </div>
          {showRejection && (
            <>
              <Select
                label="Rejection Reason"
                value={formData.rejectionReason ?? ''}
                onChange={f('rejectionReason')}
                placeholder="Select reason…"
                options={REJECTION_OPTIONS}
                error={formErrors.rejectionReason}
              />
              <Textarea label="Rejection Notes" value={formData.rejectionNotes ?? ''} onChange={f('rejectionNotes')} rows={2} error={formErrors.rejectionNotes} />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
