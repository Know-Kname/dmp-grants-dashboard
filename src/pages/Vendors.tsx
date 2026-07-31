import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import {
  useVendors, useCreateVendor,
  useUpdateVendor, useDeleteVendor,
} from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { vendorFormSchema } from '../lib/schemas';
import { formatDate } from '../lib/utils';
import { getErrorMessage } from '../lib/errors';
import { useToast } from '../lib/toast';
import type { Vendor } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Textarea,
  EmptyState, Badge, PageError, StatCard, AnimatedNumber,
  SkeletonTable, ConfirmDialog,
} from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Plus, Search, Building2, Edit, Trash2, RefreshCw, Mail, Phone } from 'lucide-react';
import { useAuth } from '../lib/auth';

/** Live form state — the input side of `vendorFormSchema`, so the two cannot drift. */
type VendorFormData = z.input<typeof vendorFormSchema>;

const initialForm: VendorFormData = {
  name: '', contactName: '', email: '', phone: '', address: '', notes: '',
};

export default function Vendors() {
  const { data: vendors = [], isLoading, error, refetch } = useVendors();
  const toast = useToast();

  const createMutation = useCreateVendor({
    onSuccess: () => { toast.success('Vendor added successfully'); setShowModal(false); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to save vendor'),
  });
  const updateMutation = useUpdateVendor({
    onSuccess: () => { toast.success('Vendor updated'); setShowModal(false); setEditingVendor(null); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update vendor'),
  });
  const deleteMutation = useDeleteVendor({
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete vendor'),
  });

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  // Write permissions. Postgres RLS is what enforces them (every policy keys off
  // `profiles.role`); hiding the controls only stops the UI offering an action
  // the server would refuse. See `lib/permissions`.
  const { can } = useAuth();
  const canCreate = can('create');
  const canEdit = can('update');
  const canDelete = can('delete');

  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  // Form state + validation. onSubmit only runs once vendorFormSchema parses.
  const form = useForm({
    schema: vendorFormSchema,
    initialValues: initialForm,
    onSubmit: (data) => {
      const payload = {
        name: data.name,
        contactName: data.contactName || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        notes: data.notes || undefined,
      };
      if (editingVendor) {
        updateMutation.mutate({ id: editingVendor.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const filteredVendors = useMemo(() => {
    if (!searchTerm) return vendors;
    const s = searchTerm.toLowerCase();
    return vendors.filter(v =>
      v.name.toLowerCase().includes(s) ||
      v.contactName?.toLowerCase().includes(s) ||
      v.email?.toLowerCase().includes(s) ||
      v.phone?.toLowerCase().includes(s)
    );
  }, [vendors, searchTerm]);

  const combinedError = error || createMutation.error || updateMutation.error || deleteMutation.error;


  const handleEdit = (v: Vendor) => {
    setEditingVendor(v);
    form.setValues({
      name: v.name,
      contactName: v.contactName || '',
      email: v.email || '',
      phone: v.phone || '',
      address: v.address || '',
      notes: v.notes || '',
    });
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    // Capture the record's fields so the undo action can re-create it
    // (with a new id) after the delete succeeds.
    const removed = deleteTarget;
    const payload = {
      name: removed.name,
      contactName: removed.contactName || undefined,
      email: removed.email || undefined,
      phone: removed.phone || undefined,
      address: removed.address || undefined,
      notes: removed.notes || undefined,
    };
    deleteMutation.mutate(removed.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success('Vendor removed', undefined, {
          action: { label: 'Undo', onClick: () => createMutation.mutate(payload) },
        });
      },
    });
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendors</h1>
          <p className="text-foreground-muted mt-1">Supplier and service provider records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          {canCreate && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={() => { form.reset(initialForm); setEditingVendor(null); setShowModal(true); }}>
              New Vendor
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Vendors" value={<AnimatedNumber to={vendors.length} />} icon={Building2} tone="primary" />
        <StatCard label="With Email" value={<AnimatedNumber to={vendors.filter(v => v.email).length} />} icon={Mail} tone="info" />
        <StatCard label="With Phone" value={<AnimatedNumber to={vendors.filter(v => v.phone).length} />} icon={Phone} tone="success" />
      </div>

      {/* Filter */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, contact, email, or phone..."
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span className="text-sm text-foreground-muted whitespace-nowrap">
              {filteredVendors.length} of {vendors.length}
            </span>
          </div>
          {searchTerm && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" size="sm">"{searchTerm}"</Badge>
              <button className="text-xs text-foreground-muted hover:text-foreground" onClick={() => setSearchTerm('')}>
                Clear
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <DataTable<Vendor>
          rows={filteredVendors}
          rowKey={v => v.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          csv={{
            filename: 'vendors',
            header: ['Company', 'Contact', 'Email', 'Phone', 'Address', 'Added'],
            row: v => [v.name, v.contactName, v.email, v.phone, v.address, v.createdAt],
          }}
          emptyState={
            <CardBody>
              <EmptyState
                icon={<Building2 size={48} />}
                title="No vendors found"
                description={searchTerm ? 'Try a different search term' : 'Add your first vendor to get started'}
                action={canCreate && !searchTerm ? <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Vendor</Button> : undefined}
              />
            </CardBody>
          }
          columns={[
            { key: 'name', header: 'Company', sortValue: v => v.name, cell: v => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100 dark:bg-primary-950 rounded-lg flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-primary" />
                </div>
                <span className="font-medium text-foreground">{v.name}</span>
              </div>
            ) },
            { key: 'contactName', header: 'Contact', sortValue: v => v.contactName, cell: v => (
              <span className="text-foreground-muted">{v.contactName || '—'}</span>
            ) },
            { key: 'email', header: 'Email', sortValue: v => v.email, cell: v => (
              v.email
                ? <a href={`mailto:${v.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail size={14} />{v.email}</a>
                : <span className="text-foreground-muted">—</span>
            ) },
            { key: 'phone', header: 'Phone', cell: v => (
              v.phone
                ? <a href={`tel:${v.phone}`} className="text-foreground hover:text-primary flex items-center gap-1"><Phone size={14} />{v.phone}</a>
                : <span className="text-foreground-muted">—</span>
            ) },
            { key: 'createdAt', header: 'Added', sortValue: v => v.createdAt, cell: v => (
              <span className="text-foreground-muted">{v.createdAt ? formatDate(v.createdAt) : '—'}</span>
            ) },
            { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: v => (
              <span className="space-x-2">
                {canEdit && (
                  <button onClick={() => handleEdit(v)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                )}
                {canDelete && (
                  <button onClick={() => setDeleteTarget(v)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
                )}
              </span>
            ) },
          ] satisfies Column<Vendor>[]}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete vendor"
        message={deleteTarget ? <>Delete <strong>{deleteTarget.name}</strong>? You can undo this right after.</> : ''}
        loading={deleteMutation.isPending}
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingVendor(null); }}
        title={editingVendor ? 'Edit Vendor' : 'New Vendor'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            {(editingVendor ? canEdit : canCreate) && (
              <Button variant="primary" loading={isMutating} onClick={() => form.handleSubmit()}>
                {editingVendor ? 'Save Changes' : 'Add Vendor'}
              </Button>
            )}
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <Input label="Company Name" {...form.getFieldProps('name')} error={getFieldError('name', form.errors, form.touched)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Name" {...form.getFieldProps('contactName')} error={getFieldError('contactName', form.errors, form.touched)} />
            <Input label="Phone" type="tel" {...form.getFieldProps('phone')} error={getFieldError('phone', form.errors, form.touched)} />
          </div>
          <Input label="Email" type="email" {...form.getFieldProps('email')} error={getFieldError('email', form.errors, form.touched)} />
          <Input label="Address" {...form.getFieldProps('address')} error={getFieldError('address', form.errors, form.touched)} />
          <Textarea label="Notes" {...form.getFieldProps('notes')} error={getFieldError('notes', form.errors, form.touched)} rows={3} />
        </form>
      </Modal>
    </div>
  );
}
