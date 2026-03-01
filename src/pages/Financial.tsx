import { useState, useMemo } from 'react';
import {
  useDeposits, useCreateDeposit,
  useReceivables, useCreateReceivable, useUpdateReceivable,
  usePayables, useCreatePayable, useUpdatePayable,
} from '../hooks/useData';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency, formatDateForInput, formatStatus } from '../lib/utils';
import type { Deposit, AccountsReceivable, AccountsPayable } from '../types';
import { Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState, LoadingSpinner } from '../components/ui';
import {
  Plus, Search, DollarSign, TrendingUp, TrendingDown, Wallet,
  AlertCircle, RefreshCw, CreditCard, Receipt, FileText, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'deposits' | 'receivables' | 'payables';

// ── Deposit Form ─────────────────────────────────
type DepositFormData = {
  amount: string;
  date: string;
  method: Deposit['method'];
  reference: string;
  customerId: string;
  notes: string;
};

const initialDepositForm: DepositFormData = {
  amount: '', date: formatDateForInput(new Date()), method: 'check',
  reference: '', customerId: '', notes: '',
};

// ── Receivable Form ──────────────────────────────
type ReceivableFormData = {
  customerId: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
};

const initialReceivableForm: ReceivableFormData = {
  customerId: '', invoiceNumber: '', amount: '', dueDate: '',
};

// ── Payable Form ─────────────────────────────────
type PayableFormData = {
  vendorId: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
};

const initialPayableForm: PayableFormData = {
  vendorId: '', invoiceNumber: '', amount: '', dueDate: '',
};

// ── Payment Form ─────────────────────────────────
type PaymentFormData = { amountPaid: string };

export default function Financial() {
  const [activeTab, setActiveTab] = useState<Tab>('deposits');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Data hooks ──
  const { data: depositsRaw, isLoading: loadingDep, error: errDep, refetch: refetchDep } = useDeposits();
  const { data: receivablesRaw, isLoading: loadingAR, error: errAR, refetch: refetchAR } = useReceivables();
  const { data: payablesRaw, isLoading: loadingAP, error: errAP, refetch: refetchAP } = usePayables();

  const deposits: Deposit[] = Array.isArray(depositsRaw) ? depositsRaw : (depositsRaw?.data ?? []);
  const receivables: AccountsReceivable[] = Array.isArray(receivablesRaw) ? receivablesRaw : (receivablesRaw?.data ?? []);
  const payables: AccountsPayable[] = Array.isArray(payablesRaw) ? payablesRaw : (payablesRaw?.data ?? []);

  // ── Mutations ──
  const [showModal, setShowModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ type: 'receivable' | 'payable'; id: string } | null>(null);

  const [depositForm, setDepositForm] = useState(initialDepositForm);
  const [receivableForm, setReceivableForm] = useState(initialReceivableForm);
  const [payableForm, setPayableForm] = useState(initialPayableForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({ amountPaid: '' });

  const createDeposit = useCreateDeposit({ onSuccess: () => { setShowModal(false); setDepositForm(initialDepositForm); } });
  const createReceivable = useCreateReceivable({ onSuccess: () => { setShowModal(false); setReceivableForm(initialReceivableForm); } });
  const createPayable = useCreatePayable({ onSuccess: () => { setShowModal(false); setPayableForm(initialPayableForm); } });
  const updateReceivable = useUpdateReceivable({ onSuccess: () => { setPaymentModal(null); setPaymentForm({ amountPaid: '' }); } });
  const updatePayable = useUpdatePayable({ onSuccess: () => { setPaymentModal(null); setPaymentForm({ amountPaid: '' }); } });

  const isMutating = createDeposit.isPending || createReceivable.isPending || createPayable.isPending
    || updateReceivable.isPending || updatePayable.isPending;

  // ── Stats ──
  const stats = useMemo(() => {
    const totalDeposits = deposits.reduce((s, d) => s + d.amount, 0);
    const outstandingAR = receivables
      .filter(r => r.status !== 'paid')
      .reduce((s, r) => s + (r.amount - r.amountPaid), 0);
    const outstandingAP = payables
      .filter(p => p.status !== 'paid')
      .reduce((s, p) => s + (p.amount - p.amountPaid), 0);
    return { totalDeposits, outstandingAR, outstandingAP, net: totalDeposits - outstandingAP };
  }, [deposits, receivables, payables]);

  // ── Filtered lists ──
  const filteredDeposits = useMemo(() => {
    if (!searchTerm) return deposits;
    const s = searchTerm.toLowerCase();
    return deposits.filter(d =>
      d.reference?.toLowerCase().includes(s) || d.method.includes(s) || d.notes?.toLowerCase().includes(s)
    );
  }, [deposits, searchTerm]);

  const filteredReceivables = useMemo(() => {
    let list = receivables;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r => r.invoiceNumber.toLowerCase().includes(s) || r.customerId.toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    return list;
  }, [receivables, searchTerm, statusFilter]);

  const filteredPayables = useMemo(() => {
    let list = payables;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p => p.invoiceNumber.toLowerCase().includes(s) || p.vendorId.toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    return list;
  }, [payables, searchTerm, statusFilter]);

  // ── Handlers ──
  const handleRefresh = () => { refetchDep(); refetchAR(); refetchAP(); };
  const isLoading = loadingDep || loadingAR || loadingAP;
  const combinedError = errDep || errAR || errAP || createDeposit.error || createReceivable.error
    || createPayable.error || updateReceivable.error || updatePayable.error;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'deposits') {
      createDeposit.mutate({
        amount: parseFloat(depositForm.amount),
        date: depositForm.date,
        method: depositForm.method,
        reference: depositForm.reference || undefined,
        customerId: depositForm.customerId || undefined,
        notes: depositForm.notes || undefined,
      });
    } else if (activeTab === 'receivables') {
      createReceivable.mutate({
        customerId: receivableForm.customerId,
        invoiceNumber: receivableForm.invoiceNumber,
        amount: parseFloat(receivableForm.amount),
        dueDate: receivableForm.dueDate,
      });
    } else {
      createPayable.mutate({
        vendorId: payableForm.vendorId,
        invoiceNumber: payableForm.invoiceNumber,
        amount: parseFloat(payableForm.amount),
        dueDate: payableForm.dueDate,
      });
    }
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    const amount = parseFloat(paymentForm.amountPaid);
    if (paymentModal.type === 'receivable') {
      updateReceivable.mutate({ id: paymentModal.id, amountPaid: amount });
    } else {
      updatePayable.mutate({ id: paymentModal.id, amountPaid: amount });
    }
  };

  const getMethodBadge = (method: Deposit['method']) => {
    const variants: Record<Deposit['method'], 'primary' | 'info' | 'success' | 'warning' | 'secondary'> = {
      cash: 'success', check: 'primary', credit_card: 'info', wire: 'warning', other: 'secondary',
    };
    return <Badge variant={variants[method]} size="sm">{formatStatus(method)}</Badge>;
  };

  const getStatusBadge = (status: AccountsReceivable['status']) => {
    const variants: Record<AccountsReceivable['status'], 'warning' | 'info' | 'success' | 'danger'> = {
      pending: 'warning', partial: 'info', paid: 'success', overdue: 'danger',
    };
    return <Badge variant={variants[status]} dot>{formatStatus(status)}</Badge>;
  };

  const tabs: { key: Tab; label: string; icon: typeof DollarSign; count: number }[] = [
    { key: 'deposits', label: 'Deposits', icon: DollarSign, count: deposits.length },
    { key: 'receivables', label: 'Receivables', icon: TrendingUp, count: receivables.length },
    { key: 'payables', label: 'Payables', icon: TrendingDown, count: payables.length },
  ];

  const addLabel = activeTab === 'deposits' ? 'Add Deposit' : activeTab === 'receivables' ? 'Add Receivable' : 'Add Payable';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financial</h1>
          <p className="text-foreground-muted mt-1">Deposits, receivables, and payables</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={<RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />}
            onClick={handleRefresh} disabled={isLoading}>Refresh</Button>
          <Button variant="primary" icon={<Plus size={20} />}
            onClick={() => setShowModal(true)}>{addLabel}</Button>
        </div>
      </div>

      {/* Error */}
      {combinedError && (
        <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-danger shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-danger">Error</h3>
            <p className="text-sm text-danger-700 dark:text-danger-400">{getErrorMessage(combinedError)}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total Deposits</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(stats.totalDeposits)}</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <DollarSign className="text-success" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Outstanding AR</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(stats.outstandingAR)}</p>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-950 rounded-lg">
                <TrendingUp className="text-warning" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Outstanding AP</p>
                <p className="text-2xl font-bold text-danger">{formatCurrency(stats.outstandingAP)}</p>
              </div>
              <div className="p-3 bg-danger-100 dark:bg-danger-950 rounded-lg">
                <TrendingDown className="text-danger" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Net Position</p>
                <p className={`text-2xl font-bold ${stats.net >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(stats.net)}
                </p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
                <Wallet className="text-primary" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-background-subtle rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearchTerm(''); setStatusFilter('all'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.key ? 'bg-primary-100 dark:bg-primary-950 text-primary' : 'bg-background-muted text-foreground-muted'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder={`Search ${activeTab}...`} icon={<Search size={18} />}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {activeTab !== 'deposits' && (
              <Select options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'partial', label: 'Partial' },
                { value: 'paid', label: 'Paid' },
                { value: 'overdue', label: 'Overdue' },
              ]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            )}
            <div className="flex items-center text-sm text-foreground-muted">
              {activeTab === 'deposits' ? filteredDeposits.length : activeTab === 'receivables' ? filteredReceivables.length : filteredPayables.length} records
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card><CardBody><div className="py-12"><LoadingSpinner size="lg" />
          <p className="text-center text-foreground-muted mt-4">Loading financial data...</p>
        </div></CardBody></Card>
      )}

      {/* ── DEPOSITS TAB ── */}
      {!isLoading && activeTab === 'deposits' && (
        filteredDeposits.length === 0 ? (
          <Card><CardBody>
            <EmptyState icon={<DollarSign size={48} />} title="No deposits found"
              description={searchTerm ? "Try adjusting your search" : "Record your first deposit"}
              action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Deposit</Button>} />
          </CardBody></Card>
        ) : (
          <div className="grid gap-4">
            {filteredDeposits.map(dep => (
              <Card key={dep.id} hoverable className="animate-fade-in">
                <CardBody>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg shrink-0">
                        <CreditCard className="text-success" size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xl font-bold text-foreground">{formatCurrency(dep.amount)}</p>
                          {getMethodBadge(dep.method)}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{format(new Date(dep.date), 'MMM d, yyyy')}</span>
                          </div>
                          {dep.reference && <span>Ref: {dep.reference}</span>}
                        </div>
                        {dep.notes && <p className="text-sm text-foreground-muted mt-2">{dep.notes}</p>}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── RECEIVABLES TAB ── */}
      {!isLoading && activeTab === 'receivables' && (
        filteredReceivables.length === 0 ? (
          <Card><CardBody>
            <EmptyState icon={<TrendingUp size={48} />} title="No receivables found"
              description={searchTerm || statusFilter !== 'all' ? "Try adjusting your filters" : "Add your first receivable"}
              action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Receivable</Button>} />
          </CardBody></Card>
        ) : (
          <div className="grid gap-4">
            {filteredReceivables.map(ar => {
              const paidPct = ar.amount > 0 ? Math.min((ar.amountPaid / ar.amount) * 100, 100) : 0;
              const isOverdue = ar.status === 'overdue';
              return (
                <Card key={ar.id} hoverable className={`animate-fade-in ${isOverdue ? 'border-l-4 border-l-danger' : ''}`}>
                  <CardBody>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="p-3 bg-warning-100 dark:bg-warning-950 rounded-lg shrink-0">
                          <Receipt className="text-warning" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-foreground">#{ar.invoiceNumber}</p>
                            {getStatusBadge(ar.status)}
                          </div>
                          <p className="text-sm text-foreground-muted mb-3">Customer: {ar.customerId}</p>
                          {/* Payment progress */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground-muted">Paid: {formatCurrency(ar.amountPaid)}</span>
                              <span className="font-medium text-foreground">of {formatCurrency(ar.amount)}</span>
                            </div>
                            <div className="w-full bg-background-muted rounded-full h-2">
                              <div className={`h-2 rounded-full transition-all ${
                                paidPct >= 100 ? 'bg-success' : paidPct >= 50 ? 'bg-warning' : 'bg-danger'
                              }`} style={{ width: `${paidPct}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-sm text-foreground-muted">
                            <Calendar size={14} />
                            <span>Due: {format(new Date(ar.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      {ar.status !== 'paid' && (
                        <Button variant="outline" size="sm"
                          onClick={() => { setPaymentModal({ type: 'receivable', id: ar.id }); setPaymentForm({ amountPaid: '' }); }}>
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── PAYABLES TAB ── */}
      {!isLoading && activeTab === 'payables' && (
        filteredPayables.length === 0 ? (
          <Card><CardBody>
            <EmptyState icon={<TrendingDown size={48} />} title="No payables found"
              description={searchTerm || statusFilter !== 'all' ? "Try adjusting your filters" : "Add your first payable"}
              action={<Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>Add Payable</Button>} />
          </CardBody></Card>
        ) : (
          <div className="grid gap-4">
            {filteredPayables.map(ap => {
              const paidPct = ap.amount > 0 ? Math.min((ap.amountPaid / ap.amount) * 100, 100) : 0;
              const isOverdue = ap.status === 'overdue';
              return (
                <Card key={ap.id} hoverable className={`animate-fade-in ${isOverdue ? 'border-l-4 border-l-danger' : ''}`}>
                  <CardBody>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="p-3 bg-danger-100 dark:bg-danger-950 rounded-lg shrink-0">
                          <FileText className="text-danger" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-foreground">#{ap.invoiceNumber}</p>
                            {getStatusBadge(ap.status)}
                          </div>
                          <p className="text-sm text-foreground-muted mb-3">Vendor: {ap.vendorId}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground-muted">Paid: {formatCurrency(ap.amountPaid)}</span>
                              <span className="font-medium text-foreground">of {formatCurrency(ap.amount)}</span>
                            </div>
                            <div className="w-full bg-background-muted rounded-full h-2">
                              <div className={`h-2 rounded-full transition-all ${
                                paidPct >= 100 ? 'bg-success' : paidPct >= 50 ? 'bg-warning' : 'bg-danger'
                              }`} style={{ width: `${paidPct}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-sm text-foreground-muted">
                            <Calendar size={14} />
                            <span>Due: {format(new Date(ap.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      {ap.status !== 'paid' && (
                        <Button variant="outline" size="sm"
                          onClick={() => { setPaymentModal({ type: 'payable', id: ap.id }); setPaymentForm({ amountPaid: '' }); }}>
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── CREATE MODAL ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={addLabel} size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreateSubmit} loading={isMutating}>{addLabel}</Button>
        </>}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {activeTab === 'deposits' && (<>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Amount" type="number" required placeholder="0.00"
                value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} />
              <Input label="Date" type="date" required
                value={depositForm.date} onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Method" value={depositForm.method}
                onChange={(e) => setDepositForm({ ...depositForm, method: e.target.value as Deposit['method'] })}
                options={[
                  { value: 'cash', label: 'Cash' }, { value: 'check', label: 'Check' },
                  { value: 'credit_card', label: 'Credit Card' }, { value: 'wire', label: 'Wire' },
                  { value: 'other', label: 'Other' },
                ]} />
              <Input label="Reference #" placeholder="Check number, transaction ID..."
                value={depositForm.reference} onChange={(e) => setDepositForm({ ...depositForm, reference: e.target.value })} />
            </div>
            <Input label="Customer ID" placeholder="Optional"
              value={depositForm.customerId} onChange={(e) => setDepositForm({ ...depositForm, customerId: e.target.value })} />
            <Textarea label="Notes" placeholder="Additional details..."
              value={depositForm.notes} onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })} />
          </>)}

          {activeTab === 'receivables' && (<>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice Number" required placeholder="INV-001"
                value={receivableForm.invoiceNumber} onChange={(e) => setReceivableForm({ ...receivableForm, invoiceNumber: e.target.value })} />
              <Input label="Customer ID" required placeholder="Customer identifier"
                value={receivableForm.customerId} onChange={(e) => setReceivableForm({ ...receivableForm, customerId: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Amount" type="number" required placeholder="0.00"
                value={receivableForm.amount} onChange={(e) => setReceivableForm({ ...receivableForm, amount: e.target.value })} />
              <Input label="Due Date" type="date" required
                value={receivableForm.dueDate} onChange={(e) => setReceivableForm({ ...receivableForm, dueDate: e.target.value })} />
            </div>
          </>)}

          {activeTab === 'payables' && (<>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice Number" required placeholder="INV-001"
                value={payableForm.invoiceNumber} onChange={(e) => setPayableForm({ ...payableForm, invoiceNumber: e.target.value })} />
              <Input label="Vendor ID" required placeholder="Vendor identifier"
                value={payableForm.vendorId} onChange={(e) => setPayableForm({ ...payableForm, vendorId: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Amount" type="number" required placeholder="0.00"
                value={payableForm.amount} onChange={(e) => setPayableForm({ ...payableForm, amount: e.target.value })} />
              <Input label="Due Date" type="date" required
                value={payableForm.dueDate} onChange={(e) => setPayableForm({ ...payableForm, dueDate: e.target.value })} />
            </div>
          </>)}
        </form>
      </Modal>

      {/* ── PAYMENT MODAL ── */}
      <Modal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)}
        title="Record Payment" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setPaymentModal(null)}>Cancel</Button>
          <Button variant="primary" onClick={handlePayment} loading={updateReceivable.isPending || updatePayable.isPending}>
            Record Payment
          </Button>
        </>}
      >
        <form onSubmit={handlePayment} className="space-y-4">
          <Input label="Payment Amount" type="number" required placeholder="0.00"
            value={paymentForm.amountPaid} onChange={(e) => setPaymentForm({ amountPaid: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
