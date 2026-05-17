import { useState } from 'react';
import { useInstruments, useCreateInstrument, useUpdateInstrument, useRemoveInstrument } from '../hooks/useData';
import { validateForm, instrumentFormSchema, type InstrumentFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { Instrument, TestCategory, InstrumentStatus } from '../types';
import { Cpu, Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';

const CATEGORY_OPTIONS: { value: TestCategory; label: string }[] = [
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'microbiology', label: 'Microbiology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'molecular', label: 'Molecular' },
  { value: 'pathology', label: 'Pathology' },
  { value: 'urinalysis', label: 'Urinalysis' },
  { value: 'panel', label: 'Panel' },
];

const STATUS_OPTIONS: { value: InstrumentStatus; label: string }[] = [
  { value: 'operational', label: 'Operational' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'out_of_service', label: 'Out of Service' },
  { value: 'retired', label: 'Retired' },
];

const STATUS_BADGE: Record<InstrumentStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  operational: 'success',
  maintenance: 'warning',
  calibration: 'warning',
  out_of_service: 'danger',
  retired: 'secondary',
};

const TODAY = new Date('2026-05-17T00:00:00');
const DUE_SOON_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

function isDueSoon(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  const diff = d.getTime() - TODAY.getTime();
  return diff >= 0 && diff <= DUE_SOON_MS;
}

function isOverdue(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getTime() < TODAY.getTime();
}

function isAlertDate(dateStr: string | undefined): boolean {
  return isDueSoon(dateStr) || isOverdue(dateStr);
}

function isRowAlert(instrument: Instrument): boolean {
  return isAlertDate(instrument.nextMaintenanceDate) || isAlertDate(instrument.nextCalibrationDate);
}

const INIT: InstrumentFormData = {
  name: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  category: 'chemistry' as TestCategory,
  location: '',
  status: 'operational' as InstrumentStatus,
  lastMaintenanceDate: '',
  nextMaintenanceDate: '',
  lastCalibrationDate: '',
  nextCalibrationDate: '',
  installDate: '',
  notes: '',
};

export default function Instruments() {
  const { data: instruments = [], isLoading, error } = useInstruments();
  const createMutation = useCreateInstrument();
  const updateMutation = useUpdateInstrument();
  const removeMutation = useRemoveInstrument();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [formData, setFormData] = useState<InstrumentFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof InstrumentFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData(INIT); setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (inst: Instrument) => {
    setEditing(inst);
    setFormData({
      name: inst.name,
      manufacturer: inst.manufacturer ?? '',
      model: inst.model ?? '',
      serialNumber: inst.serialNumber ?? '',
      category: inst.category,
      location: inst.location ?? '',
      status: inst.status,
      lastMaintenanceDate: inst.lastMaintenanceDate ?? '',
      nextMaintenanceDate: inst.nextMaintenanceDate ?? '',
      lastCalibrationDate: inst.lastCalibrationDate ?? '',
      nextCalibrationDate: inst.nextCalibrationDate ?? '',
      installDate: inst.installDate ?? '',
      notes: inst.notes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(instrumentFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      const payload = {
        ...v.data,
        manufacturer: v.data.manufacturer || undefined,
        model: v.data.model || undefined,
        serialNumber: v.data.serialNumber || undefined,
        location: v.data.location || undefined,
        lastMaintenanceDate: v.data.lastMaintenanceDate || undefined,
        nextMaintenanceDate: v.data.nextMaintenanceDate || undefined,
        lastCalibrationDate: v.data.lastCalibrationDate || undefined,
        nextCalibrationDate: v.data.nextCalibrationDate || undefined,
        installDate: v.data.installDate || undefined,
        notes: v.data.notes || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast.success('Instrument updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('Instrument created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (inst: Instrument) => {
    if (!await confirm({
      title: 'Delete instrument',
      message: `Delete "${inst.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })) return;
    try {
      await removeMutation.mutateAsync(inst.id);
      toast.success('Instrument deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = instruments.filter((inst) => {
    const q = search.toLowerCase();
    return !q || `${inst.name} ${inst.manufacturer ?? ''} ${inst.model ?? ''} ${inst.serialNumber ?? ''}`.toLowerCase().includes(q);
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instruments</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{instruments.length} instrument{instruments.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Instrument</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, manufacturer, model, or serial number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Cpu className="w-10 h-10" />}
            title="No instruments found"
            description={search ? 'Try adjusting your search.' : 'Add your first instrument to get started.'}
            action={!search ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Instrument</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Name / Model</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Next Maintenance</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Next Calibration</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inst) => {
                  const alert = isRowAlert(inst);
                  return (
                    <tr
                      key={inst.id}
                      className={`border-b border-border hover:bg-card-hover transition-colors last:border-0 ${alert ? 'border-l-4 border-l-warning bg-warning/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inst.name}</div>
                        {(inst.manufacturer || inst.model) && (
                          <div className="text-xs text-foreground-muted">
                            {[inst.manufacturer, inst.model].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {inst.serialNumber && (
                          <div className="text-xs text-foreground-muted">S/N: {inst.serialNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted hidden sm:table-cell">{formatStatus(inst.category)}</td>
                      <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{inst.location || '—'}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant={STATUS_BADGE[inst.status]} size="sm">{formatStatus(inst.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {inst.nextMaintenanceDate ? (
                          <span className={`flex items-center gap-1 ${isAlertDate(inst.nextMaintenanceDate) ? 'text-warning font-medium' : 'text-foreground-muted'}`}>
                            {isAlertDate(inst.nextMaintenanceDate) && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                            {formatDate(inst.nextMaintenanceDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {inst.nextCalibrationDate ? (
                          <span className={`flex items-center gap-1 ${isAlertDate(inst.nextCalibrationDate) ? 'text-warning font-medium' : 'text-foreground-muted'}`}>
                            {isAlertDate(inst.nextCalibrationDate) && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                            {formatDate(inst.nextCalibrationDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(inst)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(inst)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
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
        title={editing ? 'Edit Instrument' : 'New Instrument'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Instrument'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <Input label="Name" value={formData.name} onChange={f('name')} required error={formErrors.name} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Manufacturer" value={formData.manufacturer} onChange={f('manufacturer')} error={formErrors.manufacturer} />
            <Input label="Model" value={formData.model} onChange={f('model')} error={formErrors.model} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Serial Number" value={formData.serialNumber} onChange={f('serialNumber')} error={formErrors.serialNumber} />
            <Input label="Location" value={formData.location} onChange={f('location')} error={formErrors.location} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Category" value={formData.category} onChange={f('category')} options={CATEGORY_OPTIONS} required error={formErrors.category} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Last Maintenance Date" type="date" value={formData.lastMaintenanceDate} onChange={f('lastMaintenanceDate')} error={formErrors.lastMaintenanceDate} />
            <Input label="Next Maintenance Date" type="date" value={formData.nextMaintenanceDate} onChange={f('nextMaintenanceDate')} error={formErrors.nextMaintenanceDate} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Last Calibration Date" type="date" value={formData.lastCalibrationDate} onChange={f('lastCalibrationDate')} error={formErrors.lastCalibrationDate} />
            <Input label="Next Calibration Date" type="date" value={formData.nextCalibrationDate} onChange={f('nextCalibrationDate')} error={formErrors.nextCalibrationDate} />
          </div>
          <Input label="Install Date" type="date" value={formData.installDate} onChange={f('installDate')} error={formErrors.installDate} />
          <Textarea label="Notes" value={formData.notes} onChange={f('notes')} rows={3} error={formErrors.notes} />
        </div>
      </Modal>
    </div>
  );
}
