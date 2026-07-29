import { useState, useMemo } from 'react';
import type { z } from 'zod';
import {
  useDeposits, useCreateDeposit,
  useReceivables, useCreateReceivable, useUpdateReceivable,
  usePayables, useCreatePayable, useUpdatePayable,
  useVendors,
} from '../hooks/useData';
import { getErrorMessage } from '../lib/errors';
import { useForm, getFieldError } from '../hooks/useForm';
import { depositFormSchema, receivableFormSchema, payableFormSchema } from '../lib/schemas';
import { formatCurrency, formatDate, formatStatus, cn } from '../lib/utils';
import type { Deposit, AccountsReceivable, AccountsPayable } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select, Textarea,
  Badge, EmptyState, LoadingSpinner, PageError, TABLE_HEAD_CLASS } from '../components/ui';
import { Plus, DollarSign, TrendingUp, TrendingDown, RefreshCw, Edit, CreditCard, ArrowRightLeft, FileText } from 'lucide-react';
import { useToast } from '../lib/toast';

type ActiveTab = 'deposits' | 'receivables' | 'payables';

/** Live form state — the input side of `depositFormSchema`. */
type DepositForm = z.input<typeof depositFormSchema>;

/** Live form state — the input side of `receivableFormSchema`. */
type ReceivableForm = z.input<typeof receivableFormSchema>;

type ReceivableEditForm = {
  amountPaid: string;
};

/** Live form state — the input side of `payableFormSchema`. */
type PayableForm = z.input<typeof payableFormSchema>;

type PayableEditForm = {
  amountPaid: string;
};

const initialDepositForm: DepositForm = { amount: '', date: '', method: 'cash', reference: '', notes: '' };
const initialReceivableForm: ReceivableForm = { customerId: '', invoiceNumber: '', amount: '', dueDate: '' };
const initialReceivableEditForm: ReceivableEditForm = { amountPaid: '' };
const initialPayableForm: PayableForm = { vendorId: '', invoiceNumber: '', amount: '', dueDate: '' };
const initialPayableEditForm: PayableEditForm = { amountPaid: '' };

const METHOD_LABELS: Record<Deposit['method'], string> = {
  cash: 'Cash', check: 'Check', credit_card: 'Credit Card',
  wire: 'Wire Transfer', other: 'Other',
};

const MethodIcon = ({ method }: { method: Deposit['method'] }) => {
  if (method === 'credit_card') return <CreditCard size={14} className="shrink-0" />;
  if (method === 'wire') return <ArrowRightLeft size={14} className="shrink-0" />;
  if (method === 'check') return <FileText size={14} className="shrink-0" />;
  return <DollarSign size={14} className="shrink-0" />;
};

const arStatusVariant = (s: AccountsReceivable['status']) =>
  ({ pending: 'warning', partial: 'info', paid: 'success', overdue: 'danger' } as const)[s];

export default function Financial() {
  const depositsQuery = useDeposits();
  const receivablesQuery = useReceivables();
  const payablesQuery = usePayables();
  const { data: vendors = [] } = useVendors();

  const deposits = depositsQuery.data ?? [];
  const receivables = receivablesQuery.data ?? [];
  const payables = payablesQuery.data ?? [];

  const toast = useToast();
  const depositCreateMutation = useCreateDeposit({
    onSuccess: () => { toast.success('Deposit recorded'); setShowModal(false); depositForm.reset(initialDepositForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to record deposit'),
  });
  const receivableCreateMutation = useCreateReceivable({
    onSuccess: () => { toast.success('Invoice created'); setShowModal(false); receivableForm.reset(initialReceivableForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to create invoice'),
  });
  const receivableUpdateMutation = useUpdateReceivable({
    onSuccess: () => { toast.success('Invoice updated'); setShowModal(false); setEditingReceivable(null); setReceivableEditForm(initialReceivableEditForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update invoice'),
  });
  const payableCreateMutation = useCreatePayable({
    onSuccess: () => { toast.success('Bill recorded'); setShowModal(false); payableForm.reset(initialPayableForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to record bill'),
  });
  const payableUpdateMutation = useUpdatePayable({
    onSuccess: () => { toast.success('Bill updated'); setShowModal(false); setEditingPayable(null); setPayableEditForm(initialPayableEditForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update bill'),
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('deposits');
  const [showModal, setShowModal] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<AccountsReceivable | null>(null);
  const [editingPayable, setEditingPayable] = useState<AccountsPayable | null>(null);

  // Three validated create forms. The two payment-recording edit forms below
  // stay on plain state: they capture a single amount against an existing
  // invoice rather than creating a record, and have no schema of their own.
  const depositForm = useForm({
    schema: depositFormSchema,
    initialValues: initialDepositForm,
    onSubmit: (data) => {
      depositCreateMutation.mutate({
        amount: data.amount,
        date: data.date,
        method: data.method,
        reference: data.reference || undefined,
        notes: data.notes || undefined,
      });
    },
  });
  const receivableForm = useForm({
    schema: receivableFormSchema,
    initialValues: initialReceivableForm,
    onSubmit: (data) => {
      receivableCreateMutation.mutate({
        customerId: data.customerId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        dueDate: data.dueDate,
      });
    },
  });
  const [receivableEditForm, setReceivableEditForm] = useState<ReceivableEditForm>(initialReceivableEditForm);
  const payableForm = useForm({
    schema: payableFormSchema,
    initialValues: initialPayableForm,
    onSubmit: (data) => {
      payableCreateMutation.mutate({
        vendorId: data.vendorId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        dueDate: data.dueDate,
      });
    },
  });
  const [payableEditForm, setPayableEditForm] = useState<PayableEditForm>(initialPayableEditForm);

  const financialStats = useMemo(() => {
    const receivablesOutstanding = receivables
      .filter(r => r.status !== 'paid')
      .reduce((sum, r) => sum + (r.amount - r.amountPaid), 0);
    const payablesDue = payables
      .filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + (p.amount - p.amountPaid), 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDeposits = deposits
      .filter(d => new Date(d.date as string) >= thirtyDaysAgo)
      .reduce((sum, d) => sum + d.amount, 0);
    return { receivablesOutstanding, payablesDue, recentDeposits };
  }, [deposits, receivables, payables]);

  const combinedError =
    depositsQuery.error || receivablesQuery.error || payablesQuery.error ||
    depositCreateMutation.error ||
    receivableCreateMutation.error || receivableUpdateMutation.error ||
    payableCreateMutation.error || payableUpdateMutation.error;

  const isLoading = activeTab === 'deposits' ? depositsQuery.isLoading
    : activeTab === 'receivables' ? receivablesQuery.isLoading
    : payablesQuery.isLoading;

  const isMutating =
    depositCreateMutation.isPending ||
    receivableCreateMutation.isPending || receivableUpdateMutation.isPending ||
    payableCreateMutation.isPending || payableUpdateMutation.isPending;

  const handleRefetch = () => {
    if (activeTab === 'deposits') depositsQuery.refetch();
    else if (activeTab === 'receivables') receivablesQuery.refetch();
    else payablesQuery.refetch();
  };

  const handleOpenCreate = () => {
    setEditingReceivable(null);
    setEditingPayable(null);
    setShowModal(true);
  };

  const handleEditReceivable = (r: AccountsReceivable) => {
    setEditingReceivable(r);
    setReceivableEditForm({ amountPaid: String(r.amountPaid) });
    setShowModal(true);
  };

  const handleEditPayable = (p: AccountsPayable) => {
    setEditingPayable(p);
    setPayableEditForm({ amountPaid: String(p.amountPaid) });
    setShowModal(true);
  };

  // One modal serves five forms, so submission routes by tab. Creates go through
  // their validated form; the two edit paths record a payment directly.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'deposits') {
      await depositForm.handleSubmit();
    } else if (activeTab === 'receivables') {
      if (editingReceivable) {
        receivableUpdateMutation.mutate({
          id: editingReceivable.id,
          amountPaid: parseFloat(receivableEditForm.amountPaid) || 0,
        });
      } else {
        await receivableForm.handleSubmit();
      }
    } else {
      if (editingPayable) {
        payableUpdateMutation.mutate({
          id: editingPayable.id,
          amountPaid: parseFloat(payableEditForm.amountPaid) || 0,
        });
      } else {
        await payableForm.handleSubmit();
      }
    }
  };

  const modalTitle =
    activeTab === 'deposits' ? 'Record Deposit'
    : activeTab === 'receivables'
      ? (editingReceivable ? 'Record Payment (Receivable)' : 'New Invoice (Receivable)')
      : (editingPayable ? 'Record Payment (Payable)' : 'New Invoice (Payable)');

  const TABS: { value: ActiveTab; label: string }[] = [
    { value: 'deposits', label: 'Deposits' },
    { value: 'receivables', label: 'Receivables' },
    { value: 'payables', label: 'Payables' },
  ];

  const addLabel =
    activeTab === 'deposits' ? 'Record Deposit'
    : activeTab === 'receivables' ? 'New Invoice'
    : 'New Bill';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financial</h1>
          <p className="text-foreground-muted mt-1">Deposits, accounts receivable, and accounts payable</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={handleRefetch}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>
            {addLabel}
          </Button>
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Summary stats — always visible (QuickBooks style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Receivables Outstanding</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(financialStats.receivablesOutstanding)}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(['pending', 'partial', 'overdue'] as AccountsReceivable['status'][]).map(s => {
                    const count = receivables.filter(r => r.status === s).length;
                    return count > 0 ? <Badge key={s} variant={arStatusVariant(s)} size="sm">{count} {formatStatus(s)}</Badge> : null;
                  })}
                </div>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-950 rounded-lg">
                <TrendingUp className="text-warning" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Payables Due</p>
                <p className="text-2xl font-bold text-danger">{formatCurrency(financialStats.payablesDue)}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(['pending', 'partial', 'overdue'] as AccountsPayable['status'][]).map(s => {
                    const count = payables.filter(p => p.status === s).length;
                    return count > 0 ? <Badge key={s} variant={arStatusVariant(s)} size="sm">{count} {formatStatus(s)}</Badge> : null;
                  })}
                </div>
              </div>
              <div className="p-3 bg-danger-100 dark:bg-danger-950 rounded-lg">
                <TrendingDown className="text-danger" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Deposits (30 days)</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(financialStats.recentDeposits)}</p>
                <p className="text-xs text-foreground-muted mt-2">{deposits.length} total recorded</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <DollarSign className="text-success" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tab navigation */}
      <Card>
        <CardBody>
          <div className="flex gap-1 p-1 bg-background-subtle rounded-lg border border-border w-fit">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === tab.value
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

      {/* Tab content */}
      {isLoading ? (
        <Card><CardBody><LoadingSpinner className="py-8" /></CardBody></Card>
      ) : (
        <>
          {/* DEPOSITS TAB */}
          {activeTab === 'deposits' && (
            deposits.length === 0 ? (
              <Card><CardBody>
                <EmptyState icon={<DollarSign size={48} />} title="No deposits recorded" description="Record your first deposit" action={<Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>Record Deposit</Button>} />
              </CardBody></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background-subtle border-b border-border">
                      <tr>
                        <th className={TABLE_HEAD_CLASS}>Date</th>
                        <th className={TABLE_HEAD_CLASS}>Method</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Amount</th>
                        <th className={TABLE_HEAD_CLASS}>Reference</th>
                        <th className={TABLE_HEAD_CLASS}>Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {deposits.map(d => (
                        <tr key={d.id} className="hover:bg-accent/40 transition-colors">
                          <td className="px-6 py-4 text-foreground">{d.date ? formatDate(d.date) : '—'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-foreground-muted">
                              <MethodIcon method={d.method} />
                              {METHOD_LABELS[d.method]}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-success">{formatCurrency(d.amount)}</td>
                          <td className="px-6 py-4 text-foreground-muted font-mono text-xs">{d.reference || '—'}</td>
                          <td className="px-6 py-4 text-foreground-muted max-w-xs truncate">{d.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}

          {/* RECEIVABLES TAB */}
          {activeTab === 'receivables' && (
            receivables.length === 0 ? (
              <Card><CardBody>
                <EmptyState icon={<TrendingUp size={48} />} title="No receivables" description="Create your first invoice" action={<Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>New Invoice</Button>} />
              </CardBody></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background-subtle border-b border-border">
                      <tr>
                        <th className={TABLE_HEAD_CLASS}>Invoice #</th>
                        <th className={TABLE_HEAD_CLASS}>Customer</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Paid</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Balance</th>
                        <th className={TABLE_HEAD_CLASS}>Due Date</th>
                        <th className={TABLE_HEAD_CLASS}>Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {receivables.map(r => {
                        const balance = r.amount - r.amountPaid;
                        return (
                          <tr key={r.id} className="hover:bg-accent/40 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-medium text-foreground">{r.invoiceNumber}</td>
                            <td className="px-6 py-4 text-foreground-muted">{r.customerId}</td>
                            <td className="px-6 py-4 text-right text-foreground">{formatCurrency(r.amount)}</td>
                            <td className="px-6 py-4 text-right text-success">{formatCurrency(r.amountPaid)}</td>
                            <td className={cn('px-6 py-4 text-right font-medium', r.status === 'overdue' ? 'text-danger' : 'text-foreground-muted')}>
                              {formatCurrency(balance)}
                            </td>
                            <td className="px-6 py-4 text-foreground-muted">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                            <td className="px-6 py-4"><Badge variant={arStatusVariant(r.status)}>{formatStatus(r.status)}</Badge></td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => handleEditReceivable(r)} className="text-primary hover:text-primary-hover" aria-label="Record payment"><Edit size={17} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}

          {/* PAYABLES TAB */}
          {activeTab === 'payables' && (
            payables.length === 0 ? (
              <Card><CardBody>
                <EmptyState icon={<TrendingDown size={48} />} title="No payables" description="Record your first bill" action={<Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>New Bill</Button>} />
              </CardBody></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background-subtle border-b border-border">
                      <tr>
                        <th className={TABLE_HEAD_CLASS}>Invoice #</th>
                        <th className={TABLE_HEAD_CLASS}>Vendor</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Paid</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Balance</th>
                        <th className={TABLE_HEAD_CLASS}>Due Date</th>
                        <th className={TABLE_HEAD_CLASS}>Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payables.map(p => {
                        const balance = p.amount - p.amountPaid;
                        return (
                          <tr key={p.id} className="hover:bg-accent/40 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-medium text-foreground">{p.invoiceNumber}</td>
                            <td className="px-6 py-4 text-foreground-muted">{vendors.find(v => v.id === p.vendorId)?.name ?? p.vendorId}</td>
                            <td className="px-6 py-4 text-right text-foreground">{formatCurrency(p.amount)}</td>
                            <td className="px-6 py-4 text-right text-success">{formatCurrency(p.amountPaid)}</td>
                            <td className={cn('px-6 py-4 text-right font-medium', p.status === 'overdue' ? 'text-danger' : 'text-foreground-muted')}>
                              {formatCurrency(balance)}
                            </td>
                            <td className="px-6 py-4 text-foreground-muted">{p.dueDate ? formatDate(p.dueDate) : '—'}</td>
                            <td className="px-6 py-4"><Badge variant={arStatusVariant(p.status)}>{formatStatus(p.status)}</Badge></td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => handleEditPayable(p)} className="text-primary hover:text-primary-hover" aria-label="Record payment"><Edit size={17} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingReceivable(null); setEditingPayable(null); }}
        title={modalTitle}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* DEPOSIT FORM */}
          {activeTab === 'deposits' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Amount ($)" type="number" min="0" step="0.01" {...depositForm.getFieldProps('amount')} error={getFieldError('amount', depositForm.errors, depositForm.touched)} required />
                <Input label="Date" type="date" {...depositForm.getFieldProps('date')} error={getFieldError('date', depositForm.errors, depositForm.touched)} required />
              </div>
              <Select
                label="Payment Method"
                options={Object.entries(METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                {...depositForm.getFieldProps('method')}
                error={getFieldError('method', depositForm.errors, depositForm.touched)}
              />
              <Input label="Reference / Check #" {...depositForm.getFieldProps('reference')} error={getFieldError('reference', depositForm.errors, depositForm.touched)} />
              <Textarea label="Notes" {...depositForm.getFieldProps('notes')} error={getFieldError('notes', depositForm.errors, depositForm.touched)} rows={2} />
            </>
          )}

          {/* RECEIVABLE CREATE FORM */}
          {activeTab === 'receivables' && !editingReceivable && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Customer ID" {...receivableForm.getFieldProps('customerId')} error={getFieldError('customerId', receivableForm.errors, receivableForm.touched)} required />
                <Input label="Invoice #" {...receivableForm.getFieldProps('invoiceNumber')} error={getFieldError('invoiceNumber', receivableForm.errors, receivableForm.touched)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Amount ($)" type="number" min="0" step="0.01" {...receivableForm.getFieldProps('amount')} error={getFieldError('amount', receivableForm.errors, receivableForm.touched)} required />
                <Input label="Due Date" type="date" {...receivableForm.getFieldProps('dueDate')} error={getFieldError('dueDate', receivableForm.errors, receivableForm.touched)} required />
              </div>
            </>
          )}

          {/* RECEIVABLE EDIT FORM (record payment) */}
          {activeTab === 'receivables' && editingReceivable && (
            <div>
              <p className="text-sm text-foreground-muted mb-3">
                Invoice <span className="font-mono font-medium">{editingReceivable.invoiceNumber}</span> —
                Total: <span className="font-medium">{formatCurrency(editingReceivable.amount)}</span>
              </p>
              <Input
                label="Amount Paid ($)"
                type="number"
                min="0"
                step="0.01"
                max={String(editingReceivable.amount)}
                value={receivableEditForm.amountPaid}
                onChange={e => setReceivableEditForm({ amountPaid: e.target.value })}
                required
              />
            </div>
          )}

          {/* PAYABLE CREATE FORM */}
          {activeTab === 'payables' && !editingPayable && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Vendor"
                  {...payableForm.getFieldProps('vendorId')}
                  error={getFieldError('vendorId', payableForm.errors, payableForm.touched)}
                  options={vendors.map(v => ({ value: v.id, label: v.name }))}
                  placeholder="Select vendor..."
                />
                <Input label="Invoice #" {...payableForm.getFieldProps('invoiceNumber')} error={getFieldError('invoiceNumber', payableForm.errors, payableForm.touched)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Amount ($)" type="number" min="0" step="0.01" {...payableForm.getFieldProps('amount')} error={getFieldError('amount', payableForm.errors, payableForm.touched)} required />
                <Input label="Due Date" type="date" {...payableForm.getFieldProps('dueDate')} error={getFieldError('dueDate', payableForm.errors, payableForm.touched)} required />
              </div>
            </>
          )}

          {/* PAYABLE EDIT FORM (record payment) */}
          {activeTab === 'payables' && editingPayable && (
            <div>
              <p className="text-sm text-foreground-muted mb-3">
                Invoice <span className="font-mono font-medium">{editingPayable.invoiceNumber}</span> —
                Total: <span className="font-medium">{formatCurrency(editingPayable.amount)}</span>
              </p>
              <Input
                label="Amount Paid ($)"
                type="number"
                min="0"
                step="0.01"
                max={String(editingPayable.amount)}
                value={payableEditForm.amountPaid}
                onChange={e => setPayableEditForm({ amountPaid: e.target.value })}
                required
              />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
