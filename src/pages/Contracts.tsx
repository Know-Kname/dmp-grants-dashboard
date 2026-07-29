import { useState, useMemo } from 'react';
import {
  useContracts, useCreateContract,
  useUpdateContract, useDeleteContract,
  useCustomers, usePaymentSchedule,
} from '../hooks/useData';
import { formatCurrency, formatDate, formatDateForInput, cn } from '../lib/utils';
import type { Contract, ContractItem } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select,
  Badge, EmptyState, LoadingSpinner, PageError, StatCard, TABLE_HEAD_CLASS } from '../components/ui';
import { Plus, Search, FileText, Edit, Trash2, RefreshCw, DollarSign, TrendingUp, X, CalendarDays } from 'lucide-react';

type ContractFormData = {
  contractNumber: string;
  type: Contract['type'];
  customerId: string;
  totalAmount: string;
  signedDate: string;
  status: Contract['status'];
};

type LineItemDraft = {
  tempId: string;
  description: string;
  amount: string;
};

const initialForm: ContractFormData = {
  contractNumber: '', type: 'at_need', customerId: '',
  totalAmount: '', signedDate: '', status: 'active',
};

type StatusFilter = 'all' | Contract['status'];
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'transferred', label: 'Transferred' },
];

const SCHEDULE_STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'secondary'> = {
  paid: 'success', overdue: 'danger', pending: 'warning', waived: 'secondary',
};

const statusBadge = (s: Contract['status']) => {
  const map: Record<Contract['status'], 'success' | 'primary' | 'danger' | 'warning'> = {
    active: 'success', paid: 'primary', cancelled: 'danger', transferred: 'warning',
  };
  const labels: Record<Contract['status'], string> = {
    active: 'Active', paid: 'Paid', cancelled: 'Cancelled', transferred: 'Transferred',
  };
  return <Badge variant={map[s]}>{labels[s]}</Badge>;
};

const typeBadge = (t: Contract['type']) =>
  <Badge variant={t === 'pre_need' ? 'info' : 'warning'} size="sm">
    {t === 'pre_need' ? 'Pre-Need' : 'At-Need'}
  </Badge>;

function PaymentScheduleSection({ contractId }: { contractId: string }) {
  const { data: entries = [], isLoading } = usePaymentSchedule(contractId);
  if (isLoading) return <LoadingSpinner size="sm" className="py-2" />;
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground-muted py-2">
        No payment schedule entries yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-background-subtle">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-foreground-muted uppercase tracking-wider">#</th>
            <th className="px-3 py-2 text-left font-medium text-foreground-muted uppercase tracking-wider">Due</th>
            <th className="px-3 py-2 text-right font-medium text-foreground-muted uppercase tracking-wider">Amount</th>
            <th className="px-3 py-2 text-right font-medium text-foreground-muted uppercase tracking-wider">Paid</th>
            <th className="px-3 py-2 text-left font-medium text-foreground-muted uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((e, i) => (
            <tr key={e.id} className="hover:bg-accent/30">
              <td className="px-3 py-2 text-foreground-muted">{i + 1}</td>
              <td className="px-3 py-2 text-foreground">{formatDate(e.dueDate)}</td>
              <td className="px-3 py-2 text-right text-foreground">{formatCurrency(e.amount)}</td>
              <td className="px-3 py-2 text-right text-success">{formatCurrency(e.paidDate ? e.amount : 0)}</td>
              <td className="px-3 py-2">
                <Badge variant={SCHEDULE_STATUS_VARIANT[e.status] ?? 'secondary'} size="sm">
                  {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Contracts() {
  const { data: contracts = [], isLoading, error, refetch } = useContracts();
  const { data: customers = [] } = useCustomers();

  const createMutation = useCreateContract({ onSuccess: () => { setShowModal(false); setFormData(initialForm); setLineItems([]); } });
  const updateMutation = useUpdateContract({ onSuccess: () => { setShowModal(false); setEditingContract(null); setFormData(initialForm); setLineItems([]); } });
  const deleteMutation = useDeleteContract();

  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formData, setFormData] = useState<ContractFormData>(initialForm);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);

  const customerOptions = useMemo(() =>
    customers.map(c => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` })),
    [customers]
  );

  const computedTotal = useMemo(() =>
    lineItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    [lineItems]
  );

  const displayTotal = lineItems.length > 0 ? computedTotal : parseFloat(formData.totalAmount) || 0;

  const stats = useMemo(() => ({
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    totalValue: contracts.reduce((sum, c) => sum + c.totalAmount, 0),
    amountReceived: contracts.reduce((sum, c) => sum + c.amountPaid, 0),
  }), [contracts]);

  const filteredContracts = useMemo(() => {
    let filtered = contracts;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.contractNumber.toLowerCase().includes(s) ||
        c.customerId.toLowerCase().includes(s)
      );
    }
    if (typeFilter !== 'all') filtered = filtered.filter(c => c.type === typeFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
    return filtered;
  }, [contracts, searchTerm, typeFilter, statusFilter]);

  const combinedError = error || createMutation.error || updateMutation.error || deleteMutation.error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsPayload = lineItems.map(({ description, amount }) => ({
      description,
      amount: parseFloat(amount) || 0,
    }));
    const payload = {
      contractNumber: formData.contractNumber,
      type: formData.type,
      customerId: formData.customerId,
      totalAmount: lineItems.length > 0 ? computedTotal : parseFloat(formData.totalAmount) || 0,
      amountPaid: editingContract ? editingContract.amountPaid : 0,
      signedDate: formData.signedDate,
      status: formData.status,
      items: (itemsPayload.length > 0 ? itemsPayload : (editingContract?.items ?? [])) as ContractItem[],
    };
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, ...payload });
    } else {
      createMutation.mutate(payload as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleEdit = (c: Contract) => {
    setEditingContract(c);
    setFormData({
      contractNumber: c.contractNumber,
      type: c.type,
      customerId: c.customerId,
      totalAmount: String(c.totalAmount),
      signedDate: formatDateForInput(c.signedDate),
      status: c.status,
    });
    setLineItems((c.items ?? []).map(item => ({
      tempId: item.id || crypto.randomUUID(),
      description: item.description,
      amount: String(item.amount),
    })));
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this contract? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContract(null);
    setFormData(initialForm);
    setLineItems([]);
  };

  const addLineItem = () => setLineItems(prev => [
    ...prev,
    { tempId: crypto.randomUUID(), description: '', amount: '' },
  ]);

  const removeLineItem = (tempId: string) =>
    setLineItems(prev => prev.filter(i => i.tempId !== tempId));

  const updateLineItem = (tempId: string, field: 'description' | 'amount', value: string) =>
    setLineItems(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i));

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const f = (field: keyof ContractFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const customerName = (customerId: string) => {
    const c = customers.find(x => x.id === customerId);
    return c ? `${c.lastName}, ${c.firstName}` : customerId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contracts</h1>
          <p className="text-foreground-muted mt-1">Pre-need and at-need contract management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setFormData(initialForm); setEditingContract(null); setLineItems([]); setShowModal(true); }}>
            New Contract
          </Button>
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Contracts" value={stats.total} icon={FileText} tone="info" />
        <StatCard label="Active" value={stats.active} icon={TrendingUp} tone="success" />
        <StatCard label="Total Value" value={formatCurrency(stats.totalValue)} icon={DollarSign} tone="primary" />
        <StatCard label="Received" value={formatCurrency(stats.amountReceived)} icon={DollarSign} tone="success" />
      </div>

      {/* Filters + Status Tabs */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search by contract # or customer..."
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Select
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'pre_need', label: 'Pre-Need' },
                  { value: 'at_need', label: 'At-Need' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
            <span className="text-sm text-foreground-muted">{filteredContracts.length} of {contracts.length}</span>
          </div>
          <div className="flex gap-1 p-1 bg-background-subtle rounded-lg border border-border w-fit">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  statusFilter === tab.value
                    ? 'bg-card shadow-sm text-foreground border border-border'
                    : 'text-foreground-muted hover:text-foreground hover:bg-accent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card><CardBody><LoadingSpinner className="py-8" /></CardBody></Card>
      ) : filteredContracts.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FileText size={48} />}
              title="No contracts found"
              description={searchTerm || typeFilter !== 'all' || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first contract'}
              action={!searchTerm && typeFilter === 'all' && statusFilter === 'all'
                ? <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>New Contract</Button>
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
                  <th className={TABLE_HEAD_CLASS}>Contract #</th>
                  <th className={TABLE_HEAD_CLASS}>Type</th>
                  <th className={TABLE_HEAD_CLASS}>Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Balance</th>
                  <th className={TABLE_HEAD_CLASS}>Status</th>
                  <th className={TABLE_HEAD_CLASS}>Signed</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredContracts.map(c => {
                  const balance = c.totalAmount - c.amountPaid;
                  return (
                    <tr key={c.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm font-medium text-foreground">{c.contractNumber}</td>
                      <td className="px-6 py-4">{typeBadge(c.type)}</td>
                      <td className="px-6 py-4 text-foreground-muted">{customerName(c.customerId)}</td>
                      <td className="px-6 py-4 text-right text-foreground">{formatCurrency(c.totalAmount)}</td>
                      <td className="px-6 py-4 text-right text-success">{formatCurrency(c.amountPaid)}</td>
                      <td className={cn('px-6 py-4 text-right font-medium', balance > 0 ? 'text-warning' : 'text-foreground-muted')}>
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-6 py-4">{statusBadge(c.status)}</td>
                      <td className="px-6 py-4 text-foreground-muted">{c.signedDate ? formatDate(c.signedDate) : '—'}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleEdit(c)} className="text-primary hover:text-primary-hover" aria-label="Edit"><Edit size={17} /></button>
                        <button onClick={() => handleDelete(c.id)} className="text-danger hover:text-danger-hover" aria-label="Delete"><Trash2 size={17} /></button>
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
        onClose={handleCloseModal}
        title={editingContract ? 'Edit Contract' : 'New Contract'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
              {editingContract ? 'Save Changes' : 'Create Contract'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Contract Header */}
          <div>
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">Contract Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Contract Number" value={formData.contractNumber} onChange={f('contractNumber')} required />
              <Select
                label="Type"
                options={[
                  { value: 'at_need', label: 'At-Need' },
                  { value: 'pre_need', label: 'Pre-Need' },
                ]}
                value={formData.type}
                onChange={f('type')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Select
                label="Customer"
                options={customerOptions}
                value={formData.customerId}
                onChange={f('customerId')}
                placeholder="Select customer..."
              />
              <Select
                label="Status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'cancelled', label: 'Cancelled' },
                  { value: 'transferred', label: 'Transferred' },
                ]}
                value={formData.status}
                onChange={f('status')}
              />
            </div>
            <div className="mt-4">
              <Input label="Signed Date" type="date" value={formData.signedDate} onChange={f('signedDate')} required />
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Line Items</p>
              <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addLineItem} type="button">
                Add Item
              </Button>
            </div>
            {lineItems.length === 0 ? (
              <div className="flex items-center gap-3">
                <Input
                  label="Total Amount ($)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={f('totalAmount')}
                  required={lineItems.length === 0}
                />
                <p className="text-xs text-foreground-muted mt-6 whitespace-nowrap">or add line items above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.tempId} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={e => updateLineItem(item.tempId, 'description', e.target.value)}
                        required
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        placeholder="Amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={e => updateLineItem(item.tempId, 'amount', e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.tempId)}
                      className="mt-0 text-foreground-muted hover:text-danger transition-colors shrink-0"
                      aria-label="Remove item"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <div className="text-sm font-semibold text-foreground">
                    Total: {formatCurrency(computedTotal)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Summary (editing only) */}
          {editingContract && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">Payment Summary</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-background-subtle rounded-lg p-3">
                  <p className="text-xs text-foreground-muted mb-1">Contract Total</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(displayTotal)}</p>
                </div>
                <div className="bg-background-subtle rounded-lg p-3">
                  <p className="text-xs text-foreground-muted mb-1">Amount Paid</p>
                  <p className="text-base font-bold text-success">{formatCurrency(editingContract.amountPaid)}</p>
                </div>
                <div className="bg-background-subtle rounded-lg p-3">
                  <p className="text-xs text-foreground-muted mb-1">Balance Due</p>
                  <p className={cn('text-base font-bold', (displayTotal - editingContract.amountPaid) > 0 ? 'text-warning' : 'text-foreground-muted')}>
                    {formatCurrency(displayTotal - editingContract.amountPaid)}
                  </p>
                </div>
              </div>

              {/* Payment Plan Details */}
              {editingContract.paymentPlan && (
                <div className="mt-3 p-3 bg-info-50 dark:bg-info-950 border border-info-200 dark:border-info-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays size={14} className="text-info" />
                    <p className="text-xs font-medium text-info">Payment Plan</p>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    {editingContract.paymentPlan.frequency.replace('_', '-')} ·{' '}
                    {formatCurrency(editingContract.paymentPlan.installmentAmount)} / installment ·{' '}
                    Starting {formatDate(editingContract.paymentPlan.startDate)}
                    {editingContract.paymentPlan.endDate ? ` — ${formatDate(editingContract.paymentPlan.endDate)}` : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Schedule (editing pre_need only) */}
          {editingContract && editingContract.type === 'pre_need' && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">Payment Schedule</p>
              <PaymentScheduleSection contractId={editingContract.id} />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
