import { useState } from 'react';
import { useProviders, useCreateProvider, useUpdateProvider, useRemoveProvider } from '../hooks/useData';
import { validateForm, providerFormSchema, type ProviderFormData } from '../lib/schemas';
import { formatStatus } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { Provider, ProviderStatus } from '../types';
import { Stethoscope, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const STATUS_OPTIONS: { value: ProviderStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const STATUS_BADGE: Record<ProviderStatus, 'success' | 'secondary'> = {
  active: 'success',
  inactive: 'secondary',
};

const INIT: ProviderFormData = {
  npi: '', firstName: '', lastName: '', credentials: '', organization: '',
  specialty: '', phone: '', fax: '', email: '', address: '', city: '', state: '',
  zipCode: '', status: 'active' as const, notes: '',
};

export default function Providers() {
  const { data: providers = [], isLoading, error } = useProviders();
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();
  const removeMutation = useRemoveProvider();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const f = (field: keyof ProviderFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((p) => ({ ...p, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null); setFormData(INIT); setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setFormData({
      npi: p.npi,
      firstName: p.firstName,
      lastName: p.lastName,
      credentials: p.credentials ?? '',
      organization: p.organization ?? '',
      specialty: p.specialty ?? '',
      phone: p.phone ?? '',
      fax: p.fax ?? '',
      email: p.email ?? '',
      address: p.address ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      zipCode: p.zipCode ?? '',
      status: p.status,
      notes: p.notes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(providerFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: v.data });
        toast.success('Provider updated');
      } else {
        await createMutation.mutateAsync(v.data as any);
        toast.success('Provider created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (p: Provider) => {
    if (!await confirm({ title: 'Delete provider', message: `Delete ${p.firstName} ${p.lastName}? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(p.id);
      toast.success('Provider deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = providers.filter((p) => {
    const q = search.toLowerCase();
    return !q || `${p.firstName} ${p.lastName} ${p.npi} ${p.organization ?? ''} ${p.specialty ?? ''}`.toLowerCase().includes(q);
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Providers</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{providers.length} provider{providers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Provider</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, NPI, or specialty…"
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
            icon={<Stethoscope className="w-10 h-10" />}
            title="No providers found"
            description={search ? 'Try adjusting your search.' : 'Add your first provider to get started.'}
            action={!search ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Provider</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">NPI</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Name / Credentials</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Specialty</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{p.npi}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{p.firstName} {p.lastName}</div>
                      {p.credentials && <div className="text-xs text-foreground-muted">{p.credentials}</div>}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{p.specialty || '—'}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{p.organization || '—'}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{p.phone || '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={STATUS_BADGE[p.status]} size="sm">{formatStatus(p.status)}</Badge>
                    </td>
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
        title={editing ? 'Edit Provider' : 'New Provider'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Provider'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="NPI" value={formData.npi} onChange={f('npi')} required placeholder="1234567890" error={formErrors.npi} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First Name" value={formData.firstName} onChange={f('firstName')} required error={formErrors.firstName} />
            <Input label="Last Name" value={formData.lastName} onChange={f('lastName')} required error={formErrors.lastName} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Credentials" value={formData.credentials ?? ''} onChange={f('credentials')} placeholder="MD, DO, NP…" error={formErrors.credentials} />
            <Input label="Organization" value={formData.organization ?? ''} onChange={f('organization')} error={formErrors.organization} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Specialty" value={formData.specialty ?? ''} onChange={f('specialty')} error={formErrors.specialty} />
            <Input label="Phone" type="tel" value={formData.phone ?? ''} onChange={f('phone')} placeholder="(555) 000-0000" error={formErrors.phone} />
            <Input label="Fax" type="tel" value={formData.fax ?? ''} onChange={f('fax')} placeholder="(555) 000-0000" error={formErrors.fax} />
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
          <Textarea label="Notes" value={formData.notes ?? ''} onChange={f('notes')} rows={3} error={formErrors.notes} />
        </div>
      </Modal>
    </div>
  );
}
