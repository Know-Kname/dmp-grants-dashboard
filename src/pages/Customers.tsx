import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import {
  useCustomers, useCreateCustomer,
  useUpdateCustomer, useDeleteCustomer,
} from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { customerFormSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errors';
import { formatDate } from '../lib/utils';
import type { Customer } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Textarea,
  EmptyState, Avatar, Badge, PageError, StatCard, AnimatedNumber,
  SkeletonTable, ConfirmDialog,
} from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Plus, Search, Users, Edit, Trash2, RefreshCw, Mail, Phone } from 'lucide-react';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';

/** Live form state — the input side of `customerFormSchema`, so the two cannot drift. */
type CustomerFormData = z.input<typeof customerFormSchema>;

const initialForm: CustomerFormData = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', city: '', state: '', zipCode: '', notes: '',
};

export default function Customers() {
  const { data: customers = [], isLoading, error, refetch } = useCustomers();

  const toast = useToast();
  const createMutation = useCreateCustomer({
    onSuccess: () => { toast.success('Customer added'); setShowModal(false); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to add customer'),
  });
  const updateMutation = useUpdateCustomer({
    onSuccess: () => { toast.success('Customer updated'); setShowModal(false); setEditingCustomer(null); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update customer'),
  });
  const deleteMutation = useDeleteCustomer({
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Write permissions. Postgres RLS is what enforces them (every policy keys off
  // `profiles.role`); hiding the controls only stops the UI offering an action
  // the server would refuse. See `lib/permissions`.
  const { can } = useAuth();
  const canCreate = can('create');
  const canEdit = can('update');
  const canDelete = can('delete');

  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  // Form state + validation. onSubmit only runs once customerFormSchema parses.
  const form = useForm({
    schema: customerFormSchema,
    initialValues: initialForm,
    onSubmit: (data) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        notes: data.notes || undefined,
      };
      if (editingCustomer) {
        updateMutation.mutate({ id: editingCustomer.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const s = searchTerm.toLowerCase();
    return customers.filter(c =>
      c.firstName.toLowerCase().includes(s) ||
      c.lastName.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  }, [customers, searchTerm]);

  const combinedError = error || createMutation.error || updateMutation.error || deleteMutation.error;

  // Every path that opens the modal normalises the form first. `reset` sets
  // values *and* clears `errors`/`touched`; `setValues` cleared neither, so a
  // failed create used to leave its complaints on whatever opened next.
  const handleOpenCreate = () => {
    form.reset(initialForm);
    setEditingCustomer(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    form.reset(initialForm);
  };

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    // Spread `initialForm` first: `reset` replaces wholesale rather than
    // merging, so any field not seeded here would land as `undefined`.
    form.reset({
      ...initialForm,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zipCode: c.zipCode || '',
      notes: c.notes || '',
    });
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    // Capture the record's fields so the undo action can re-create it
    // (with a new id) after the delete succeeds.
    const removed = deleteTarget;
    const payload = {
      firstName: removed.firstName,
      lastName: removed.lastName,
      email: removed.email || undefined,
      phone: removed.phone || undefined,
      address: removed.address || undefined,
      city: removed.city || undefined,
      state: removed.state || undefined,
      zipCode: removed.zipCode || undefined,
      notes: removed.notes || undefined,
    };
    deleteMutation.mutate(removed.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success('Customer removed', undefined, {
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
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-foreground-muted mt-1">Contact records and family information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          {canCreate && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>
              New Customer
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Customers" value={<AnimatedNumber to={customers.length} />} icon={Users} tone="primary" />
        <StatCard label="With Email" value={<AnimatedNumber to={customers.filter(c => c.email).length} />} icon={Mail} tone="info" />
        <StatCard label="With Phone" value={<AnimatedNumber to={customers.filter(c => c.phone).length} />} icon={Phone} tone="success" />
      </div>

      {/* Filter */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, or phone..."
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span className="text-sm text-foreground-muted whitespace-nowrap">
              {filteredCustomers.length} of {customers.length}
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
        <DataTable<Customer>
          rows={filteredCustomers}
          rowKey={c => c.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          csv={{
            filename: 'customers',
            header: ['Last Name', 'First Name', 'Email', 'Phone', 'City', 'State', 'ZIP', 'Added'],
            row: c => [c.lastName, c.firstName, c.email, c.phone, c.city, c.state, c.zipCode, c.createdAt],
          }}
          emptyState={
            <CardBody>
              <EmptyState
                icon={<Users size={48} />}
                title="No customers found"
                description={searchTerm ? 'Try a different search term' : 'Add your first customer to get started'}
                action={canCreate && !searchTerm ? <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>Add Customer</Button> : undefined}
              />
            </CardBody>
          }
          columns={[
            { key: 'name', header: 'Name', sortValue: c => `${c.lastName}, ${c.firstName}`, cell: c => (
              <div className="flex items-center gap-3">
                <Avatar fallback={`${c.firstName[0] || '?'}${c.lastName[0] || '?'}`} size="sm" />
                <span className="font-medium text-foreground">{c.lastName}, {c.firstName}</span>
              </div>
            ) },
            { key: 'email', header: 'Email', sortValue: c => c.email, cell: c => (
              c.email
                ? <a href={`mailto:${c.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail size={14} />{c.email}</a>
                : <span className="text-foreground-muted">—</span>
            ) },
            { key: 'phone', header: 'Phone', cell: c => (
              c.phone
                ? <a href={`tel:${c.phone}`} className="text-foreground hover:text-primary flex items-center gap-1"><Phone size={14} />{c.phone}</a>
                : <span className="text-foreground-muted">—</span>
            ) },
            { key: 'location', header: 'Location', sortValue: c => [c.city, c.state].filter(Boolean).join(', '), cell: c => (
              <span className="text-foreground-muted">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</span>
            ) },
            { key: 'createdAt', header: 'Added', sortValue: c => c.createdAt, cell: c => (
              <span className="text-foreground-muted">{c.createdAt ? formatDate(c.createdAt) : '—'}</span>
            ) },
            { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: c => (
              <span className="space-x-2">
                {canEdit && (
                  <button onClick={() => handleEdit(c)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                )}
                {canDelete && (
                  <button onClick={() => setDeleteTarget(c)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
                )}
              </span>
            ) },
          ] satisfies Column<Customer>[]}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete customer"
        message={deleteTarget ? <>Delete <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>? You can undo this right after.</> : ''}
        loading={deleteMutation.isPending}
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Edit Customer' : 'New Customer'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
            {(editingCustomer ? canEdit : canCreate) && (
              <Button variant="primary" loading={isMutating} onClick={() => form.handleSubmit()}>
                {editingCustomer ? 'Save Changes' : 'Add Customer'}
              </Button>
            )}
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" {...form.getFieldProps('firstName')} error={getFieldError('firstName', form.errors, form.touched)} required />
            <Input label="Last Name" {...form.getFieldProps('lastName')} error={getFieldError('lastName', form.errors, form.touched)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" {...form.getFieldProps('email')} error={getFieldError('email', form.errors, form.touched)} />
            <Input label="Phone" type="tel" {...form.getFieldProps('phone')} error={getFieldError('phone', form.errors, form.touched)} />
          </div>
          <Input label="Address" {...form.getFieldProps('address')} error={getFieldError('address', form.errors, form.touched)} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" {...form.getFieldProps('city')} error={getFieldError('city', form.errors, form.touched)} />
            <Input label="State" {...form.getFieldProps('state')} error={getFieldError('state', form.errors, form.touched)} />
            <Input label="ZIP Code" {...form.getFieldProps('zipCode')} error={getFieldError('zipCode', form.errors, form.touched)} />
          </div>
          <Textarea label="Notes" {...form.getFieldProps('notes')} error={getFieldError('notes', form.errors, form.touched)} rows={3} />
        </form>
      </Modal>
    </div>
  );
}
