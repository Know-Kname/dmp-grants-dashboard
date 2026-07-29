import { useState, useMemo } from 'react';
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
  EmptyState, LoadingSpinner, Avatar, Badge, PageError, StatCard, TABLE_HEAD_CLASS } from '../components/ui';
import { Plus, Search, Users, Edit, Trash2, RefreshCw, Mail, Phone } from 'lucide-react';
import { useToast } from '../lib/toast';

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
    onSuccess: () => toast.success('Customer removed'),
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    form.setValues({
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

  const handleDelete = (id: string) => {
    if (confirm('Delete this customer? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
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
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { form.reset(initialForm); setEditingCustomer(null); setShowModal(true); }}>
            New Customer
          </Button>
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Customers" value={customers.length} icon={Users} tone="primary" />
        <StatCard label="With Email" value={customers.filter(c => c.email).length} icon={Mail} tone="info" />
        <StatCard label="With Phone" value={customers.filter(c => c.phone).length} icon={Phone} tone="success" />
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
        <Card><CardBody><LoadingSpinner className="py-8" /></CardBody></Card>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Users size={48} />}
              title="No customers found"
              description={searchTerm ? 'Try a different search term' : 'Add your first customer to get started'}
              action={!searchTerm ? <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Customer</Button> : undefined}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-subtle border-b border-border">
                <tr>
                  <th className={TABLE_HEAD_CLASS}>Name</th>
                  <th className={TABLE_HEAD_CLASS}>Email</th>
                  <th className={TABLE_HEAD_CLASS}>Phone</th>
                  <th className={TABLE_HEAD_CLASS}>Location</th>
                  <th className={TABLE_HEAD_CLASS}>Added</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar fallback={`${c.firstName[0] || '?'}${c.lastName[0] || '?'}`} size="sm" />
                        <span className="font-medium text-foreground">{c.lastName}, {c.firstName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.email
                        ? <a href={`mailto:${c.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail size={14} />{c.email}</a>
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {c.phone
                        ? <a href={`tel:${c.phone}`} className="text-foreground hover:text-primary flex items-center gap-1"><Phone size={14} />{c.phone}</a>
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {c.createdAt ? formatDate(c.createdAt) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(c)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                      <button onClick={() => handleDelete(c.id)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingCustomer(null); }}
        title={editingCustomer ? 'Edit Customer' : 'New Customer'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={() => form.handleSubmit()}>
              {editingCustomer ? 'Save Changes' : 'Add Customer'}
            </Button>
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
