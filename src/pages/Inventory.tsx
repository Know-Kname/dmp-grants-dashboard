import { useState, useMemo } from 'react';
import {
  useInventory, useCreateInventoryItem,
  useUpdateInventoryItem, useDeleteInventoryItem,
} from '../hooks/useData';
import { getErrorMessage, getErrorDetails, getErrorRequestId } from '../lib/errors';
import { formatCurrency, cn } from '../lib/utils';
import type { InventoryItem } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select,
  Badge, EmptyState, LoadingSpinner,
} from '../components/ui';
import {
  Plus, Search, Package, Edit, Trash2,
  AlertCircle, RefreshCw, AlertTriangle, DollarSign,
} from 'lucide-react';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

type InventoryFormData = {
  name: string;
  category: InventoryItem['category'];
  sku: string;
  quantity: string;
  reorderPoint: string;
  unitPrice: string;
  location: string;
};

const initialForm: InventoryFormData = {
  name: '', category: 'supplies', sku: '',
  quantity: '', reorderPoint: '', unitPrice: '', location: '',
};

const CATEGORIES: { value: InventoryItem['category']; label: string }[] = [
  { value: 'casket', label: 'Casket' },
  { value: 'urn', label: 'Urn' },
  { value: 'vault', label: 'Vault' },
  { value: 'marker', label: 'Marker' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'other', label: 'Other' },
];

export default function Inventory() {
  const { data: items = [], isLoading, error, refetch } = useInventory();

  const toast = useToast();
  const createMutation = useCreateInventoryItem({
    onSuccess: () => { toast.success('Item created'); setShowModal(false); setFormData(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to create item'),
  });
  const updateMutation = useUpdateInventoryItem({
    onSuccess: () => { toast.success('Item updated'); setShowModal(false); setEditingItem(null); setFormData(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update item'),
  });
  const deleteMutation = useDeleteInventoryItem({
    onSuccess: () => toast.success('Item removed'),
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const { confirm } = useConfirm();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [formData, setFormData] = useState<InventoryFormData>(initialForm);

  const stats = useMemo(() => ({
    lowStock: items.filter(i => i.quantity <= i.reorderPoint).length,
    total: items.length,
    totalValue: items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
  }), [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s)
      );
    }
    if (categoryFilter !== 'all') filtered = filtered.filter(i => i.category === categoryFilter);
    if (lowStockOnly) filtered = filtered.filter(i => i.quantity <= i.reorderPoint);
    return filtered;
  }, [items, searchTerm, categoryFilter, lowStockOnly]);

  const combinedError = error || createMutation.error || updateMutation.error || deleteMutation.error;
  const errorDetails = combinedError ? getErrorDetails(combinedError) : [];
  const errorRequestId = combinedError ? getErrorRequestId(combinedError) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      category: formData.category,
      sku: formData.sku || undefined,
      quantity: parseInt(formData.quantity, 10) || 0,
      reorderPoint: parseInt(formData.reorderPoint, 10) || 0,
      unitPrice: parseFloat(formData.unitPrice) || 0,
      location: formData.location || undefined,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload });
    } else {
      createMutation.mutate(payload as Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      sku: item.sku || '',
      quantity: String(item.quantity),
      reorderPoint: String(item.reorderPoint),
      unitPrice: String(item.unitPrice),
      location: item.location || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (await confirm('Delete this inventory item? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const f = (field: keyof InventoryFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-foreground-muted mt-1">Caskets, urns, vaults, markers, and supplies</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setFormData(initialForm); setEditingItem(null); setShowModal(true); }}>
            Add Item
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

      {/* Stats — urgency first */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Low Stock</p>
                <p className="text-2xl font-bold text-warning">{stats.lowStock}</p>
                <p className="text-xs text-foreground-muted mt-1">need reordering</p>
              </div>
              <div className="relative p-3 bg-warning-100 dark:bg-warning-950 rounded-lg">
                <AlertTriangle className="text-warning" size={24} />
                {stats.lowStock > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-warning rounded-full animate-pulse" />
                )}
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total Items</p>
                <p className="text-2xl font-bold text-info">{stats.total}</p>
                <p className="text-xs text-foreground-muted mt-1">in stock</p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-950 rounded-lg">
                <Package className="text-info" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total Value</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(stats.totalValue)}</p>
                <p className="text-xs text-foreground-muted mt-1">inventory worth</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <DollarSign className="text-success" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search by name or SKU..."
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                options={[{ value: 'all', label: 'All Categories' }, ...CATEGORIES]}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              />
            </div>
            <Button
              variant={lowStockOnly ? 'danger' : 'outline'}
              size="sm"
              icon={<AlertTriangle size={15} />}
              onClick={() => setLowStockOnly(!lowStockOnly)}
            >
              Low Stock Only
            </Button>
            <span className="text-sm text-foreground-muted">
              {filteredItems.length} of {items.length}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card><CardBody><LoadingSpinner className="py-8" /></CardBody></Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Package size={48} />}
              title="No items found"
              description={searchTerm || categoryFilter !== 'all' || lowStockOnly ? 'Try adjusting your filters' : 'Add your first inventory item'}
              action={!searchTerm && categoryFilter === 'all' && !lowStockOnly
                ? <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Item</Button>
                : undefined}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Reorder Pt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map(item => {
                  const isLow = item.quantity <= item.reorderPoint;
                  return (
                    <tr key={item.id} className={cn('hover:bg-accent/40 transition-colors', isLow && 'bg-warning-50 dark:bg-warning-950/20')}>
                      <td className="px-6 py-4 font-medium text-foreground">{item.name}</td>
                      <td className="px-6 py-4 capitalize text-foreground-muted">{item.category}</td>
                      <td className="px-6 py-4 font-mono text-xs text-foreground-muted">{item.sku || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={isLow ? 'font-bold text-warning' : 'text-foreground'}>{item.quantity}</span>
                          {isLow && <Badge variant="warning" size="sm">Low Stock</Badge>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground-muted">{item.reorderPoint}</td>
                      <td className="px-6 py-4 text-foreground">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-6 py-4 text-foreground-muted">{item.location || '—'}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleEdit(item)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        title={editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Item Name" value={formData.name} onChange={f('name')} required />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              options={CATEGORIES}
              value={formData.category}
              onChange={f('category')}
            />
            <Input label="SKU" value={formData.sku} onChange={f('sku')} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity" type="number" min="0" value={formData.quantity} onChange={f('quantity')} required />
            <Input label="Reorder Point" type="number" min="0" value={formData.reorderPoint} onChange={f('reorderPoint')} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Unit Price ($)" type="number" min="0" step="0.01" value={formData.unitPrice} onChange={f('unitPrice')} required />
            <Input label="Storage Location" value={formData.location} onChange={f('location')} placeholder="Optional" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
