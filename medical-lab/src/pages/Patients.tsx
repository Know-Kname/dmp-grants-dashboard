import { useState } from 'react';
import { usePatients, useCreatePatient, useUpdatePatient, useRemovePatient } from '../hooks/useData';
import { validateForm, patientFormSchema, type PatientFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { Patient, Sex } from '../types';
import { Users, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

const INIT: PatientFormData = {
  mrn: '', firstName: '', lastName: '', middleName: '', dateOfBirth: '',
  sex: 'unknown', phone: '', email: '', address: '', city: '', state: '', zipCode: '',
  insuranceProvider: '', insurancePolicyNumber: '', insuranceGroupNumber: '', notes: '',
};

export default function Patients() {
  const { data: patients = [], isLoading, error } = usePatients();
  const createMutation = useCreatePatient();
  const updateMutation = useUpdatePatient();
  const removeMutation = useRemovePatient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<PatientFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof PatientFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData(INIT); setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setFormData({
      mrn: p.mrn, firstName: p.firstName, lastName: p.lastName,
      middleName: p.middleName ?? '', dateOfBirth: p.dateOfBirth, sex: p.sex,
      phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '',
      city: p.city ?? '', state: p.state ?? '', zipCode: p.zipCode ?? '',
      insuranceProvider: p.insuranceProvider ?? '',
      insurancePolicyNumber: p.insurancePolicyNumber ?? '',
      insuranceGroupNumber: p.insuranceGroupNumber ?? '',
      notes: p.notes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(patientFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: v.data });
        toast.success('Patient updated');
      } else {
        await createMutation.mutateAsync(v.data as any);
        toast.success('Patient created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (p: Patient) => {
    if (!await confirm({ title: 'Delete patient', message: `Delete ${p.firstName} ${p.lastName}? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(p.id);
      toast.success('Patient deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return !q || `${p.firstName} ${p.lastName} ${p.mrn}`.toLowerCase().includes(q);
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Patients</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{patients.length} patient{patients.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Patient</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or MRN…"
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
            icon={<Users className="w-10 h-10" />}
            title="No patients found"
            description={search ? 'Try adjusting your search.' : 'Add your first patient to get started.'}
            action={!search ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Patient</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">MRN</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">DOB</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Sex</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Insurance</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Phone</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{p.mrn}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.firstName} {p.lastName}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{formatDate(p.dateOfBirth)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="secondary" size="sm">{formatStatus(p.sex)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{p.insuranceProvider || '—'}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{p.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
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
        title={editing ? 'Edit Patient' : 'New Patient'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Patient'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="MRN" value={formData.mrn} onChange={f('mrn')} required placeholder="MRN-00001" error={formErrors.mrn} />
            <Select label="Sex" value={formData.sex} onChange={f('sex')} options={SEX_OPTIONS} required error={formErrors.sex} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="First Name" value={formData.firstName} onChange={f('firstName')} required error={formErrors.firstName} />
            <Input label="Middle Name" value={formData.middleName ?? ''} onChange={f('middleName')} error={formErrors.middleName} />
            <Input label="Last Name" value={formData.lastName} onChange={f('lastName')} required error={formErrors.lastName} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Date of Birth" type="date" value={formData.dateOfBirth} onChange={f('dateOfBirth')} required error={formErrors.dateOfBirth} />
            <Input label="Phone" type="tel" value={formData.phone ?? ''} onChange={f('phone')} placeholder="(555) 000-0000" error={formErrors.phone} />
          </div>
          <Input label="Email" type="email" value={formData.email ?? ''} onChange={f('email')} error={formErrors.email} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input label="Address" value={formData.address ?? ''} onChange={f('address')} error={formErrors.address} />
            </div>
            <Input label="Zip Code" value={formData.zipCode ?? ''} onChange={f('zipCode')} error={formErrors.zipCode} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="City" value={formData.city ?? ''} onChange={f('city')} error={formErrors.city} />
            <Input label="State" value={formData.state ?? ''} onChange={f('state')} error={formErrors.state} />
          </div>
          <p className="text-sm font-medium text-foreground-muted pt-2 border-t border-border">Insurance</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Insurance Provider" value={formData.insuranceProvider ?? ''} onChange={f('insuranceProvider')} error={formErrors.insuranceProvider} />
            <Input label="Policy Number" value={formData.insurancePolicyNumber ?? ''} onChange={f('insurancePolicyNumber')} error={formErrors.insurancePolicyNumber} />
            <Input label="Group Number" value={formData.insuranceGroupNumber ?? ''} onChange={f('insuranceGroupNumber')} error={formErrors.insuranceGroupNumber} />
          </div>
          <Textarea label="Notes" value={formData.notes ?? ''} onChange={f('notes')} rows={3} error={formErrors.notes} />
        </div>
      </Modal>
    </div>
  );
}
