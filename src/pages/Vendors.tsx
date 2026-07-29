import { useState, useMemo } from 'react';
import {
  useVendors, useCreateVendor,
  useUpdateVendor, useDeleteVendor,
} from '../hooks/useData';
import { formatDate } from '../lib/utils';
import type { Vendor } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Textarea,
  EmptyState, LoadingSpinner, Badge, PageError, StatCard, TABLE_HEAD_CLASS } from '../components/ui';
import { Plus, Search, Building2, Edit, Trash2, RefreshCw, Mail, Phone } from 'lucide-react';

type VendorFormData = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const initialForm: VendorFormData = {
  name: '', contactName: '', email: '', phone: '', address: '', notes: '',
};

export default function Vendors() {
  const { data: vendors = [], isLoading, error, refetch } = useVendors();

  const createMutation = useCreateVendor({ onSuccess: () => { setShowModal(false); setFormData(initialForm); } });
  const updateMutation = useUpdateVendor({ onSuccess: () => { setShowModal(false); setEditingVendor(null); setFormData(initialForm); } });
  const deleteMutation = useDeleteVendor();

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<VendorFormData>(initialForm);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      contactName: formData.contactName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
    };
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, ...payload });
    } else {
      createMutation.mutate(payload as Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({
      name: v.name,
      contactName: v.contactName || '',
      email: v.email || '',
      phone: v.phone || '',
      address: v.address || '',
      notes: v.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this vendor? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const f = (field: keyof VendorFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

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
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setFormData(initialForm); setEditingVendor(null); setShowModal(true); }}>
            New Vendor
          </Button>
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Vendors" value={vendors.length} icon={Building2} tone="primary" />
        <StatCard label="With Email" value={vendors.filter(v => v.email).length} icon={Mail} tone="info" />
        <StatCard label="With Phone" value={vendors.filter(v => v.phone).length} icon={Phone} tone="success" />
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
        <Card><CardBody><LoadingSpinner className="py-8" /></CardBody></Card>
      ) : filteredVendors.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Building2 size={48} />}
              title="No vendors found"
              description={searchTerm ? 'Try a different search term' : 'Add your first vendor to get started'}
              action={!searchTerm ? <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Vendor</Button> : undefined}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-subtle border-b border-border">
                <tr>
                  <th className={TABLE_HEAD_CLASS}>Company</th>
                  <th className={TABLE_HEAD_CLASS}>Contact</th>
                  <th className={TABLE_HEAD_CLASS}>Email</th>
                  <th className={TABLE_HEAD_CLASS}>Phone</th>
                  <th className={TABLE_HEAD_CLASS}>Added</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVendors.map(v => (
                  <tr key={v.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 dark:bg-primary-950 rounded-lg flex items-center justify-center shrink-0">
                          <Building2 size={16} className="text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {v.contactName || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {v.email
                        ? <a href={`mailto:${v.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail size={14} />{v.email}</a>
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {v.phone
                        ? <a href={`tel:${v.phone}`} className="text-foreground hover:text-primary flex items-center gap-1"><Phone size={14} />{v.phone}</a>
                        : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {v.createdAt ? formatDate(v.createdAt) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(v)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                      <button onClick={() => handleDelete(v.id)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
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
        onClose={() => { setShowModal(false); setEditingVendor(null); }}
        title={editingVendor ? 'Edit Vendor' : 'New Vendor'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
              {editingVendor ? 'Save Changes' : 'Add Vendor'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Company Name" value={formData.name} onChange={f('name')} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Name" value={formData.contactName} onChange={f('contactName')} />
            <Input label="Phone" type="tel" value={formData.phone} onChange={f('phone')} />
          </div>
          <Input label="Email" type="email" value={formData.email} onChange={f('email')} />
          <Input label="Address" value={formData.address} onChange={f('address')} />
          <Textarea label="Notes" value={formData.notes} onChange={f('notes')} rows={3} />
        </form>
      </Modal>
    </div>
  );
}
