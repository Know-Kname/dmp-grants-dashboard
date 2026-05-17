import { useState } from 'react';
import {
  useOrders, useCreateOrder, useUpdateOrder, useRemoveOrder,
  usePatients, useProviders, useTestCatalog,
} from '../hooks/useData';
import { formatDate, formatStatus, formatCurrency } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { TestOrder, OrderPriority, OrderStatus } from '../types';
import { ClipboardList, Plus, Search, Pencil, Trash2, X } from 'lucide-react';

const PRIORITY_OPTIONS: { value: OrderPriority; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'stat', label: 'STAT' },
  { value: 'asap', label: 'ASAP' },
];

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'collected', label: 'Collected' },
  { value: 'received', label: 'Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resulted', label: 'Resulted' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE: Record<OrderStatus, 'secondary' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  ordered: 'secondary',
  collected: 'info',
  received: 'info',
  in_progress: 'warning',
  resulted: 'primary',
  completed: 'success',
  cancelled: 'danger',
};

const PRIORITY_BADGE: Record<OrderPriority, 'secondary' | 'warning' | 'danger'> = {
  routine: 'secondary',
  asap: 'warning',
  stat: 'danger',
};

interface LineItem { testCatalogId: string; testName: string; price: number }

interface FormState {
  patientId: string;
  providerId: string;
  priority: OrderPriority;
  status: OrderStatus;
  orderedDate: string;
  clinicalNotes: string;
  icd10Codes: string;
  items: LineItem[];
}

const INIT: FormState = {
  patientId: '', providerId: '', priority: 'routine', status: 'ordered',
  orderedDate: new Date().toISOString().slice(0, 10),
  clinicalNotes: '', icd10Codes: '', items: [],
};

function nextOrderNumber(orders: TestOrder[]): string {
  const nums = orders.map((o) => parseInt(o.orderNumber.replace(/\D/g, '') || '0', 10));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `ORD-${new Date().getFullYear()}-${next}`;
}

export default function Orders() {
  const { data: orders = [], isLoading, error } = useOrders();
  const { data: patients = [] } = usePatients();
  const { data: providers = [] } = useProviders();
  const { data: catalog = [] } = useTestCatalog();
  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder();
  const removeMutation = useRemoveOrder();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TestOrder | null>(null);
  const [formData, setFormData] = useState<FormState>(INIT);
  const [submitError, setSubmitError] = useState('');
  const [testSearch, setTestSearch] = useState('');

  const f = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setFormData((p) => ({ ...p, [field]: e.target.value }));

  const openNew = () => {
    setEditing(null);
    setFormData({ ...INIT, orderedDate: new Date().toISOString().slice(0, 10) });
    setSubmitError('');
    setTestSearch('');
    setShowModal(true);
  };

  const openEdit = (o: TestOrder) => {
    setEditing(o);
    setFormData({
      patientId: o.patientId,
      providerId: o.providerId,
      priority: o.priority,
      status: o.status,
      orderedDate: o.orderedDate,
      clinicalNotes: o.clinicalNotes ?? '',
      icd10Codes: (o.icd10Codes ?? []).join(', '),
      items: o.items.map((it) => ({ testCatalogId: it.testCatalogId, testName: it.testName, price: it.price })),
    });
    setSubmitError('');
    setTestSearch('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const addItem = (cat: typeof catalog[0]) => {
    if (formData.items.some((it) => it.testCatalogId === cat.id)) return;
    setFormData((p) => ({ ...p, items: [...p.items, { testCatalogId: cat.id, testName: cat.name, price: cat.price }] }));
    setTestSearch('');
  };

  const removeItem = (id: string) =>
    setFormData((p) => ({ ...p, items: p.items.filter((it) => it.testCatalogId !== id) }));

  const handleSubmit = async () => {
    if (!formData.patientId) { setSubmitError('Patient is required'); return; }
    if (!formData.providerId) { setSubmitError('Provider is required'); return; }
    if (formData.items.length === 0) { setSubmitError('Add at least one test'); return; }
    setSubmitError('');
    const icd10Codes = formData.icd10Codes.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: { ...formData, icd10Codes, items: formData.items },
        });
        toast.success('Order updated');
      } else {
        await createMutation.mutateAsync({
          orderNumber: nextOrderNumber(orders),
          patientId: formData.patientId,
          providerId: formData.providerId,
          priority: formData.priority,
          status: formData.status,
          orderedDate: formData.orderedDate,
          clinicalNotes: formData.clinicalNotes || undefined,
          icd10Codes,
          items: formData.items,
        });
        toast.success('Order created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (o: TestOrder) => {
    if (!await confirm({ title: 'Cancel order', message: `Delete ${o.orderNumber}? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(o.id);
      toast.success('Order deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const patientName = (id: string) => { const p = patients.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : '—'; };
  const providerName = (id: string) => { const p = providers.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : '—'; };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchQ = !q || o.orderNumber.toLowerCase().includes(q) || patientName(o.patientId).toLowerCase().includes(q);
    const matchS = !statusFilter || o.status === statusFilter;
    return matchQ && matchS;
  });

  const catalogSuggestions = catalog.filter((c) => {
    const q = testSearch.toLowerCase();
    return c.active && q && (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }).slice(0, 8);

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Orders</h1>
          <p className="text-foreground-muted text-sm mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Order</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by order # or patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-10 h-10" />}
            title="No orders found"
            description="Create a new test order to get started."
            action={<Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Order</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Order #</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Tests</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-foreground">{patientName(o.patientId)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{providerName(o.providerId)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={PRIORITY_BADGE[o.priority]} size="sm">{o.priority.toUpperCase()}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[o.status]} size="sm">{formatStatus(o.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{formatDate(o.orderedDate)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{o.items.length} test{o.items.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(o)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors"><Trash2 className="w-4 h-4" /></button>
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
        title={editing ? `Edit ${editing.orderNumber}` : 'New Test Order'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Order'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Patient"
              value={formData.patientId}
              onChange={f('patientId')}
              required
              placeholder="Select patient…"
              options={patients.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName} (${p.mrn})` }))}
            />
            <Select
              label="Referring Provider"
              value={formData.providerId}
              onChange={f('providerId')}
              required
              placeholder="Select provider…"
              options={providers.filter((p) => p.status === 'active').map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}${p.credentials ? ', ' + p.credentials : ''}` }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Priority" value={formData.priority} onChange={f('priority')} options={PRIORITY_OPTIONS} required />
            <Select label="Status" value={formData.status} onChange={f('status')} options={STATUS_OPTIONS} required />
            <Input label="Order Date" type="date" value={formData.orderedDate} onChange={f('orderedDate')} required />
          </div>
          <Input label="ICD-10 Codes" value={formData.icd10Codes} onChange={f('icd10Codes')} placeholder="E11.9, Z00.00 (comma-separated)" />
          <Textarea label="Clinical Notes" value={formData.clinicalNotes} onChange={f('clinicalNotes')} rows={2} />

          {/* Test line items */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Tests <span className="text-danger">*</span></p>
            {formData.items.length > 0 && (
              <div className="border border-border rounded-lg mb-2 divide-y divide-border">
                {formData.items.map((it) => (
                  <div key={it.testCatalogId} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-foreground">{it.testName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-foreground-muted">{formatCurrency(it.price)}</span>
                      <button onClick={() => removeItem(it.testCatalogId)} className="text-foreground-muted hover:text-danger"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-2 text-sm flex justify-end font-medium text-foreground">
                  Total: {formatCurrency(formData.items.reduce((s, it) => s + it.price, 0))}
                </div>
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="Search tests to add…"
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                className="w-full h-9 px-3 bg-card border border-input rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {catalogSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                  {catalogSuggestions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addItem(c)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                    >
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-foreground-muted ml-2">{formatCurrency(c.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
