import { useState } from 'react';
import { useStaff, useCreateStaff, useUpdateStaff, useRemoveStaff } from '../hooks/useData';
import { validateForm, staffFormSchema, type StaffFormData } from '../lib/schemas';
import { formatDate, formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { StaffMember, StaffRole, Department, StaffStatus } from '../types';
import { UserCog, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'lab_director', label: 'Lab Director' },
  { value: 'pathologist', label: 'Pathologist' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'medical_technologist', label: 'Medical Technologist' },
  { value: 'technician', label: 'Technician' },
  { value: 'phlebotomist', label: 'Phlebotomist' },
  { value: 'admin', label: 'Admin' },
];

const DEPT_OPTIONS: { value: Department | ''; label: string }[] = [
  { value: '', label: 'No department' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'microbiology', label: 'Microbiology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'pathology', label: 'Pathology' },
  { value: 'phlebotomy', label: 'Phlebotomy' },
  { value: 'general', label: 'General' },
];

const STATUS_OPTIONS: { value: StaffStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
];

const STATUS_BADGE: Record<StaffStatus, 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  on_leave: 'warning',
  inactive: 'secondary',
};

const INIT: StaffFormData = {
  firstName: '', lastName: '', email: '', role: 'technician' as StaffRole,
  licenseNumber: '', licenseType: '', licenseExpiry: '', department: '' as any,
  phone: '', status: 'active' as StaffStatus, hireDate: '', notes: '',
};

export default function Staff() {
  const { data: staff = [], isLoading, error } = useStaff();
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();
  const removeMutation = useRemoveStaff();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof StaffFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData(INIT); setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setFormData({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      role: s.role,
      licenseNumber: s.licenseNumber ?? '',
      licenseType: s.licenseType ?? '',
      licenseExpiry: s.licenseExpiry ?? '',
      department: s.department ?? ('' as any),
      phone: s.phone ?? '',
      status: s.status,
      hireDate: s.hireDate ?? '',
      notes: s.notes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(staffFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      const payload = { ...v.data, department: v.data.department || undefined };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast.success('Staff member updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('Staff member created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (s: StaffMember) => {
    if (!await confirm({ title: 'Delete staff member', message: `Delete ${s.firstName} ${s.lastName}? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(s.id);
      toast.success('Staff member deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();
    return !q || `${s.firstName} ${s.lastName} ${s.email} ${s.role}`.toLowerCase().includes(q);
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{staff.length} staff member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Staff Member</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, email, or role…"
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
            icon={<UserCog className="w-10 h-10" />}
            title="No staff members found"
            description={search ? 'Try adjusting your search.' : 'Add your first staff member to get started.'}
            action={!search ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Staff Member</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">License Expiry</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.firstName} {s.lastName}</div>
                      <div className="text-xs text-foreground-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden sm:table-cell">{formatStatus(s.role)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{s.department ? formatStatus(s.department) : '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={STATUS_BADGE[s.status]} size="sm">{formatStatus(s.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">
                      {s.licenseExpiry ? formatDate(s.licenseExpiry) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
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
        title={editing ? 'Edit Staff Member' : 'New Staff Member'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Staff Member'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First Name" value={formData.firstName} onChange={f('firstName')} required error={formErrors.firstName} />
            <Input label="Last Name" value={formData.lastName} onChange={f('lastName')} required error={formErrors.lastName} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email" type="email" value={formData.email} onChange={f('email')} required error={formErrors.email} />
            <Input label="Phone" type="tel" value={formData.phone ?? ''} onChange={f('phone')} placeholder="(555) 000-0000" error={formErrors.phone} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Role" value={formData.role} onChange={f('role')} options={ROLE_OPTIONS} required error={formErrors.role} />
            <Select label="Department" value={formData.department ?? ''} onChange={f('department')} options={DEPT_OPTIONS} error={formErrors.department} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="License Number" value={formData.licenseNumber ?? ''} onChange={f('licenseNumber')} error={formErrors.licenseNumber} />
            <Input label="License Type" value={formData.licenseType ?? ''} onChange={f('licenseType')} error={formErrors.licenseType} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="License Expiry" type="date" value={formData.licenseExpiry ?? ''} onChange={f('licenseExpiry')} error={formErrors.licenseExpiry} />
            <Input label="Hire Date" type="date" value={formData.hireDate ?? ''} onChange={f('hireDate')} error={formErrors.hireDate} />
          </div>
          <Textarea label="Notes" value={formData.notes ?? ''} onChange={f('notes')} rows={3} error={formErrors.notes} />
        </div>
      </Modal>
    </div>
  );
}
