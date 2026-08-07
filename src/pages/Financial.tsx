import { useAuth } from '../lib/auth';
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
  Badge, EmptyState, PageError, StatCard, AnimatedNumber, SkeletonTable, Tabs,
} from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Plus, DollarSign, TrendingUp, TrendingDown, RefreshCw, Edit, CreditCard, ArrowRightLeft, FileText, Search } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { useToast } from '../lib/toast';

/** AR aging buckets over unpaid invoices, keyed by days past due. */
const AGING_BUCKETS = [
  { key: 'current', label: 'Current', test: (d: number) => d <= 0 },
  { key: '1-30', label: '1–30 days', test: (d: number) => d >= 1 && d <= 30 },
  { key: '31-60', label: '31–60 days', test: (d: number) => d >= 31 && d <= 60 },
  { key: '61-90', label: '61–90 days', test: (d: number) => d >= 61 && d <= 90 },
  { key: '90+', label: '90+ days', test: (d: number) => d > 90 },
] as const;

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

  // Write permissions. Postgres RLS is what enforces them (every policy keys off
  // `profiles.role`); hiding the controls only stops the UI offering an action
  // the server would refuse. See `lib/permissions`.
  const { can } = useAuth();
  const canCreate = can('create');
  // Recording a payment is an UPDATE. Nothing on this page deletes, so there is
  // deliberately no `canDelete` here — money records are never removed, only
  // superseded.
  const canEdit = can('update');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  // Per-tab filtering — the page previously had no search or filters at all.
  const filteredDeposits = useMemo(() => {
    if (!searchTerm) return deposits;
    const s = searchTerm.toLowerCase();
    return deposits.filter(d =>
      d.reference?.toLowerCase().includes(s) ||
      d.notes?.toLowerCase().includes(s) ||
      METHOD_LABELS[d.method].toLowerCase().includes(s)
    );
  }, [deposits, searchTerm]);

  const filteredReceivables = useMemo(() => {
    let result = receivables;
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.invoiceNumber.toLowerCase().includes(s) ||
        r.customerId.toLowerCase().includes(s)
      );
    }
    return result;
  }, [receivables, searchTerm, statusFilter]);

  const filteredPayables = useMemo(() => {
    let result = payables;
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.invoiceNumber.toLowerCase().includes(s) ||
        (vendors.find(v => v.id === p.vendorId)?.name ?? p.vendorId).toLowerCase().includes(s)
      );
    }
    return result;
  }, [payables, searchTerm, statusFilter, vendors]);

  // AR aging — outstanding balance per days-past-due bucket
  const arAging = useMemo(() => {
    const today = new Date();
    const open = receivables.filter(r => r.status !== 'paid');
    return AGING_BUCKETS.map(bucket => {
      const rows = open.filter(r => {
        const pastDue = r.dueDate ? differenceInCalendarDays(today, new Date(r.dueDate)) : 0;
        return bucket.test(pastDue);
      });
      return {
        ...bucket,
        total: rows.reduce((sum, r) => sum + (r.amount - r.amountPaid), 0),
        count: rows.length,
      };
    });
  }, [receivables]);

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

  /**
   * Put all five forms back to their initial state.
   *
   * One modal serves five forms here, and it is the page — not the modal — that
   * owns them, so closing the modal discards nothing on its own. Without this,
   * an abandoned create came back with its values intact on the next open, and
   * a failed one came back with its errors. `reset` is what clears `errors` and
   * `touched`; nothing else does.
   *
   * Called only on open and close. Deliberately *not* called on tab switch —
   * that would throw away a form the user is part-way through.
   */
  const resetForms = () => {
    depositForm.reset(initialDepositForm);
    receivableForm.reset(initialReceivableForm);
    payableForm.reset(initialPayableForm);
    setReceivableEditForm(initialReceivableEditForm);
    setPayableEditForm(initialPayableEditForm);
  };

  const handleOpenCreate = () => {
    resetForms();
    setEditingReceivable(null);
    setEditingPayable(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingReceivable(null);
    setEditingPayable(null);
    resetForms();
  };

  const handleEditReceivable = (r: AccountsReceivable) => {
    resetForms();
    setEditingReceivable(r);
    setReceivableEditForm({ amountPaid: String(r.amountPaid) });
    setShowModal(true);
  };

  const handleEditPayable = (p: AccountsPayable) => {
    resetForms();
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
          {canCreate && (
            <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      <PageError error={combinedError} />

      {/* Summary stats — always visible (QuickBooks style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Receivables Outstanding"
          value={<AnimatedNumber to={financialStats.receivablesOutstanding} format={formatCurrency} />}
          icon={TrendingUp} tone="warning"
          hint={
            <span className="flex gap-1.5 mt-1 flex-wrap">
              {(['pending', 'partial', 'overdue'] as AccountsReceivable['status'][]).map(s => {
                const count = receivables.filter(r => r.status === s).length;
                return count > 0 ? <Badge key={s} variant={arStatusVariant(s)} size="sm">{count} {formatStatus(s)}</Badge> : null;
              })}
            </span>
          }
        />
        <StatCard
          label="Payables Due"
          value={<AnimatedNumber to={financialStats.payablesDue} format={formatCurrency} />}
          icon={TrendingDown} tone="danger"
          hint={
            <span className="flex gap-1.5 mt-1 flex-wrap">
              {(['pending', 'partial', 'overdue'] as AccountsPayable['status'][]).map(s => {
                const count = payables.filter(p => p.status === s).length;
                return count > 0 ? <Badge key={s} variant={arStatusVariant(s)} size="sm">{count} {formatStatus(s)}</Badge> : null;
              })}
            </span>
          }
        />
        <StatCard
          label="Deposits (30 days)"
          value={<AnimatedNumber to={financialStats.recentDeposits} format={formatCurrency} />}
          icon={DollarSign} tone="success"
          hint={`${deposits.length} total recorded`}
        />
      </div>

      {/* Tabs + filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <Tabs
              tabs={TABS.map(t => ({
                value: t.value,
                label: t.label,
                count: t.value === 'deposits' ? deposits.length : t.value === 'receivables' ? receivables.length : payables.length,
              }))}
              active={activeTab}
              onChange={(v) => { setActiveTab(v as ActiveTab); setStatusFilter('all'); }}
            />
            <div className="flex-1">
              <Input
                placeholder={activeTab === 'deposits' ? 'Search reference, notes, method…' : 'Search invoice #, name…'}
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeTab !== 'deposits' && (
              <div className="sm:w-44">
                <Select
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'partial', label: 'Partial' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'overdue', label: 'Overdue' },
                  ]}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* AR aging buckets — only meaningful on the receivables tab */}
      {activeTab === 'receivables' && !isLoading && receivables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {arAging.map(bucket => (
            <Card key={bucket.key} padding="sm" className={cn(
              bucket.key === '90+' && bucket.total > 0 ? 'border-danger' :
              bucket.key === '61-90' && bucket.total > 0 ? 'border-warning' : ''
            )}>
              <p className="text-[11px] uppercase tracking-wider text-foreground-muted">{bucket.label}</p>
              <p className={cn(
                'text-lg font-bold mt-1',
                bucket.total === 0 ? 'text-foreground-subtle' :
                bucket.key === '90+' ? 'text-danger' :
                bucket.key === '61-90' ? 'text-warning' : 'text-foreground'
              )}>
                {formatCurrency(bucket.total)}
              </p>
              <p className="text-xs text-foreground-muted">{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Tab content */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <>
          {/* DEPOSITS TAB */}
          {activeTab === 'deposits' && (
            <DataTable<Deposit>
              rows={filteredDeposits}
              rowKey={d => d.id}
              initialSort={{ key: 'date', dir: 'desc' }}
              csv={{
                filename: 'deposits',
                header: ['Date', 'Method', 'Amount', 'Reference', 'Notes'],
                row: d => [d.date, METHOD_LABELS[d.method], d.amount, d.reference, d.notes],
              }}
              emptyState={
                <CardBody>
                  <EmptyState icon={<DollarSign size={48} />} title="No deposits recorded" description={searchTerm ? 'Try adjusting your search' : 'Record your first deposit'} action={canCreate && <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>Record Deposit</Button>} />
                </CardBody>
              }
              columns={[
                { key: 'date', header: 'Date', sortValue: d => d.date, cell: d => <span className="text-foreground">{d.date ? formatDate(d.date) : '—'}</span> },
                { key: 'method', header: 'Method', sortValue: d => METHOD_LABELS[d.method], cell: d => (
                  <div className="flex items-center gap-1.5 text-foreground-muted">
                    <MethodIcon method={d.method} />
                    {METHOD_LABELS[d.method]}
                  </div>
                ) },
                { key: 'amount', header: 'Amount', align: 'right', sortValue: d => d.amount, cell: d => <span className="font-medium text-success">{formatCurrency(d.amount)}</span> },
                { key: 'reference', header: 'Reference', cell: d => <span className="text-foreground-muted font-mono text-xs">{d.reference || '—'}</span> },
                { key: 'notes', header: 'Notes', cell: d => <span className="text-foreground-muted block max-w-xs truncate">{d.notes || '—'}</span> },
              ] satisfies Column<Deposit>[]}
            />
          )}

          {/* RECEIVABLES TAB */}
          {activeTab === 'receivables' && (
            <DataTable<AccountsReceivable>
              rows={filteredReceivables}
              rowKey={r => r.id}
              initialSort={{ key: 'dueDate', dir: 'asc' }}
              csv={{
                filename: 'receivables',
                header: ['Invoice #', 'Customer', 'Amount', 'Paid', 'Balance', 'Due Date', 'Status'],
                row: r => [r.invoiceNumber, r.customerId, r.amount, r.amountPaid, r.amount - r.amountPaid, r.dueDate, r.status],
              }}
              emptyState={
                <CardBody>
                  <EmptyState icon={<TrendingUp size={48} />} title="No receivables" description={searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice'} action={canCreate && <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>New Invoice</Button>} />
                </CardBody>
              }
              columns={[
                { key: 'invoiceNumber', header: 'Invoice #', sortValue: r => r.invoiceNumber, cell: r => <span className="font-mono text-xs font-medium text-foreground">{r.invoiceNumber}</span> },
                { key: 'customer', header: 'Customer', cell: r => <span className="text-foreground-muted">{r.customerId}</span> },
                { key: 'amount', header: 'Amount', align: 'right', sortValue: r => r.amount, cell: r => <span className="text-foreground">{formatCurrency(r.amount)}</span> },
                { key: 'paid', header: 'Paid', align: 'right', sortValue: r => r.amountPaid, cell: r => <span className="text-success">{formatCurrency(r.amountPaid)}</span> },
                { key: 'balance', header: 'Balance', align: 'right', sortValue: r => r.amount - r.amountPaid, cell: r => (
                  <span className={cn('font-medium', r.status === 'overdue' ? 'text-danger' : 'text-foreground-muted')}>
                    {formatCurrency(r.amount - r.amountPaid)}
                  </span>
                ) },
                { key: 'dueDate', header: 'Due Date', sortValue: r => r.dueDate, cell: r => <span className="text-foreground-muted">{r.dueDate ? formatDate(r.dueDate) : '—'}</span> },
                { key: 'status', header: 'Status', sortValue: r => r.status, cell: r => <Badge variant={arStatusVariant(r.status)}>{formatStatus(r.status)}</Badge> },
                { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: r => canEdit ? (
                  <button onClick={() => handleEditReceivable(r)} className="text-primary hover:text-primary-hover" aria-label="Record payment"><Edit size={17} /></button>
                ) : null },
              ] satisfies Column<AccountsReceivable>[]}
            />
          )}

          {/* PAYABLES TAB */}
          {activeTab === 'payables' && (
            <DataTable<AccountsPayable>
              rows={filteredPayables}
              rowKey={p => p.id}
              initialSort={{ key: 'dueDate', dir: 'asc' }}
              csv={{
                filename: 'payables',
                header: ['Invoice #', 'Vendor', 'Amount', 'Paid', 'Balance', 'Due Date', 'Status'],
                row: p => [p.invoiceNumber, vendors.find(v => v.id === p.vendorId)?.name ?? p.vendorId, p.amount, p.amountPaid, p.amount - p.amountPaid, p.dueDate, p.status],
              }}
              emptyState={
                <CardBody>
                  <EmptyState icon={<TrendingDown size={48} />} title="No payables" description={searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Record your first bill'} action={canCreate && <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>New Bill</Button>} />
                </CardBody>
              }
              columns={[
                { key: 'invoiceNumber', header: 'Invoice #', sortValue: p => p.invoiceNumber, cell: p => <span className="font-mono text-xs font-medium text-foreground">{p.invoiceNumber}</span> },
                { key: 'vendor', header: 'Vendor', sortValue: p => vendors.find(v => v.id === p.vendorId)?.name ?? p.vendorId, cell: p => <span className="text-foreground-muted">{vendors.find(v => v.id === p.vendorId)?.name ?? p.vendorId}</span> },
                { key: 'amount', header: 'Amount', align: 'right', sortValue: p => p.amount, cell: p => <span className="text-foreground">{formatCurrency(p.amount)}</span> },
                { key: 'paid', header: 'Paid', align: 'right', sortValue: p => p.amountPaid, cell: p => <span className="text-success">{formatCurrency(p.amountPaid)}</span> },
                { key: 'balance', header: 'Balance', align: 'right', sortValue: p => p.amount - p.amountPaid, cell: p => (
                  <span className={cn('font-medium', p.status === 'overdue' ? 'text-danger' : 'text-foreground-muted')}>
                    {formatCurrency(p.amount - p.amountPaid)}
                  </span>
                ) },
                { key: 'dueDate', header: 'Due Date', sortValue: p => p.dueDate, cell: p => <span className="text-foreground-muted">{p.dueDate ? formatDate(p.dueDate) : '—'}</span> },
                { key: 'status', header: 'Status', sortValue: p => p.status, cell: p => <Badge variant={arStatusVariant(p.status)}>{formatStatus(p.status)}</Badge> },
                { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: p => canEdit ? (
                  <button onClick={() => handleEditPayable(p)} className="text-primary hover:text-primary-hover" aria-label="Record payment"><Edit size={17} /></button>
                ) : null },
              ] satisfies Column<AccountsPayable>[]}
            />
          )}
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={modalTitle}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
            {((editingReceivable || editingPayable) ? canEdit : canCreate) && (
              <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
                Save
              </Button>
            )}
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
