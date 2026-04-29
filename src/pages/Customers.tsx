import { useState, useMemo } from 'react';
import {
  useCustomers, useCreateCustomer,
  useUpdateCustomer, useDeleteCustomer,
} from '../hooks/useData';
import { getErrorMessage, getErrorDetails, getErrorRequestId } from '../lib/errors';
import { formatDate } from '../lib/utils';
import type { Customer } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Textarea,
  EmptyState, LoadingSpinner, Avatar, Badge,
} from '../components/ui';
import {
  Plus, Search, Users, Edit, Trash2,
  AlertCircle, RefreshCw, Mail, Phone,
} from 'lucide-react';
import { useToast } from '../lib/toast';

type CustomerFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
};

const initialForm: CustomerFormData = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', city: '', state: '', zipCode: '', notes: '',
};

export default function Customers() {
  const { data: customers = [], isLoading, error, refetch } = useCustomers();

  const toast = useToast();
  const createMutation = useCreateCustomer({
    onSuccess: () => { toast.success('Customer added'); setShowModal(false); setFormData(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to add customer'),
  });
  const updateMutation = useUpdateCustomer({
    onSuccess: () => { toast.success('Customer updated'); setShowModal(false); setEditingCustomer(null); setFormData(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update customer'),
  });
  const deleteMutation = useDeleteCustomer({
    onSuccess: () => toast.success('Customer removed'),
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<CustomerFormData>(initialForm);

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
  const errorDetails = combinedError ? getErrorDetails(combinedError) : [];
  const errorRequestId = combinedError ? getErrorRequestId(combinedError) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      zipCode: formData.zipCode || undefined,
      notes: formData.notes || undefined,
    };
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, ...payload });
    } else {
      createMutation.mutate(payload as Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
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

  const f = (field: keyof CustomerFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

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
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setFormData(initialForm); setEditingCustomer(null); setShowModal(true); }}>
            New Customer
          </Button>
        </div>
      </div>

      {/* Error */}
      {combinedError && (
        <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-danger shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-danger">Error</h3>
            <p className="text-sm text-danger-700 dark:text-danger-400">{getErrorMessage(combinedError)}</p>
            {(errorDetails.length > 0 || errorRequestId) && (
              <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 list-disc pl-5 space-y-1">
                {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
                {errorRequestId && <li>Request ID: {errorRequestId}</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-primary">{customers.length}</p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
                <Users className="text-primary" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">With Email</p>
                <p className="text-2xl font-bold text-info">{customers.filter(c => c.email).length}</p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-950 rounded-lg">
                <Mail className="text-info" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">With Phone</p>
                <p className="text-2xl font-bold text-success">{customers.filter(c => c.phone).length}</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <Phone className="text-success" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Added</th>
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
            <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
              {editingCustomer ? 'Save Changes' : 'Add Customer'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={formData.firstName} onChange={f('firstName')} required />
            <Input label="Last Name" value={formData.lastName} onChange={f('lastName')} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={formData.email} onChange={f('email')} />
            <Input label="Phone" type="tel" value={formData.phone} onChange={f('phone')} />
          </div>
          <Input label="Address" value={formData.address} onChange={f('address')} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" value={formData.city} onChange={f('city')} />
            <Input label="State" value={formData.state} onChange={f('state')} />
            <Input label="ZIP Code" value={formData.zipCode} onChange={f('zipCode')} />
          </div>
          <Textarea label="Notes" value={formData.notes} onChange={f('notes')} rows={3} />
        </form>
      </Modal>
    </div>
  );
}
