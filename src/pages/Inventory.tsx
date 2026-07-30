import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import {
  useInventory, useCreateInventoryItem,
  useUpdateInventoryItem, useDeleteInventoryItem,
} from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { inventoryFormSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency, cn } from '../lib/utils';
import type { InventoryItem } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select,
  Badge, EmptyState, PageError, StatCard, AnimatedNumber, SkeletonTable, ConfirmDialog,
  TABLE_HEAD_CLASS } from '../components/ui';
import { Plus, Search, Package, Edit, Trash2, RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';
import { useToast } from '../lib/toast';

/** Live form state — the input side of `inventoryFormSchema`, so the two cannot drift. */
type InventoryFormData = z.input<typeof inventoryFormSchema>;

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
    onSuccess: () => { toast.success('Item created'); setShowModal(false); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to create item'),
  });
  const updateMutation = useUpdateInventoryItem({
    onSuccess: () => { toast.success('Item updated'); setShowModal(false); setEditingItem(null); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update item'),
  });
  const deleteMutation = useDeleteInventoryItem({
    onSuccess: () => { toast.success('Item removed'); setDeleteTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  // Seeded from ?q= so other screens can deep-link a specific item
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  // Form state + validation. onSubmit only runs once the schema parses.
  const form = useForm({
    schema: inventoryFormSchema,
    initialValues: initialForm,
    onSubmit: (data) => {
      const payload = {
        name: data.name,
        category: data.category,
        sku: data.sku || undefined,
        quantity: data.quantity,
        reorderPoint: data.reorderPoint,
        unitPrice: data.unitPrice,
        location: data.location || undefined,
      };
      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

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


  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    form.setValues({
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

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

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
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { form.reset(initialForm); setEditingItem(null); setShowModal(true); }}>
            Add Item
          </Button>
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats — urgency first */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Low Stock"
          value={<AnimatedNumber to={stats.lowStock} />}
          icon={AlertTriangle}
          tone={stats.lowStock > 0 ? 'danger' : 'warning'}
          hint="need reordering"
        />
        <StatCard
          label="Total Items"
          value={<AnimatedNumber to={stats.total} />}
          icon={Package}
          tone="info"
          hint="in stock"
        />
        <StatCard
          label="Total Value"
          value={<AnimatedNumber to={stats.totalValue} format={formatCurrency} />}
          icon={DollarSign}
          tone="success"
          hint="inventory worth"
        />
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
        <SkeletonTable rows={6} cols={8} />
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
                  <th className={TABLE_HEAD_CLASS}>Name</th>
                  <th className={TABLE_HEAD_CLASS}>Category</th>
                  <th className={TABLE_HEAD_CLASS}>SKU</th>
                  <th className={TABLE_HEAD_CLASS}>Qty</th>
                  <th className={TABLE_HEAD_CLASS}>Reorder Pt</th>
                  <th className={TABLE_HEAD_CLASS}>Unit Price</th>
                  <th className={TABLE_HEAD_CLASS}>Location</th>
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
                        <button onClick={() => setDeleteTarget(item)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title="Delete Inventory Item"
        loading={deleteMutation.isPending}
        message={
          <>
            Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
            This cannot be undone.
          </>
        }
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        title={editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={() => form.handleSubmit()}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <Input label="Item Name" {...form.getFieldProps('name')} error={getFieldError('name', form.errors, form.touched)} required />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              options={CATEGORIES}
              {...form.getFieldProps('category')}
              error={getFieldError('category', form.errors, form.touched)}
            />
            <Input label="SKU" {...form.getFieldProps('sku')} error={getFieldError('sku', form.errors, form.touched)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity" type="number" min="0" {...form.getFieldProps('quantity')} error={getFieldError('quantity', form.errors, form.touched)} required />
            <Input label="Reorder Point" type="number" min="0" {...form.getFieldProps('reorderPoint')} error={getFieldError('reorderPoint', form.errors, form.touched)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Unit Price ($)" type="number" min="0" step="0.01" {...form.getFieldProps('unitPrice')} error={getFieldError('unitPrice', form.errors, form.touched)} required />
            <Input label="Storage Location" {...form.getFieldProps('location')} error={getFieldError('location', form.errors, form.touched)} placeholder="Optional" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
