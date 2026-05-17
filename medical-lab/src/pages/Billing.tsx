import { useState } from 'react';
import {
  useInvoices, useCreateInvoice, useUpdateInvoice, useRemoveInvoice,
  useClaims, useCreateClaim, useUpdateClaim, useRemoveClaim,
  useOrders, usePatients,
} from '../hooks/useData';
import {
  validateForm, invoiceFormSchema, claimFormSchema,
  type InvoiceFormData, type ClaimFormData,
} from '../lib/schemas';
import { formatDate, formatStatus, formatCurrency } from '../lib/utils';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { getErrorMessage } from '../lib/errors';
import {
  Button, Input, Select, Textarea, Modal, Badge, EmptyState,
  LoadingSpinner, Alert, Card,
} from '../components/ui';
import type { Invoice, InsuranceClaim, InvoiceStatus, ClaimStatus } from '../types';
import { Receipt, FilePlus, Plus, Search, Pencil, Trash2 } from 'lucide-react';

// ─── Invoice constants ────────────────────────────────────────────────────────

const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

const INVOICE_BADGE: Record<InvoiceStatus, 'secondary' | 'primary' | 'warning' | 'success' | 'danger'> = {
  draft: 'secondary',
  sent: 'primary',
  partial: 'warning',
  paid: 'success',
  overdue: 'danger',
  void: 'secondary',
};

const INVOICE_INIT: InvoiceFormData = {
  invoiceNumber: '', orderId: '', patientId: '', totalAmount: 0, amountPaid: 0,
  status: 'draft', issueDate: '', dueDate: '', insuranceClaimId: '', notes: '',
};

// ─── Claim constants ──────────────────────────────────────────────────────────

const CLAIM_STATUS_OPTIONS: { value: ClaimStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'partially_approved', label: 'Partially Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'paid', label: 'Paid' },
];

const CLAIM_BADGE: Record<ClaimStatus, 'secondary' | 'primary' | 'warning' | 'success' | 'danger'> = {
  draft: 'secondary',
  submitted: 'primary',
  in_review: 'warning',
  approved: 'success',
  partially_approved: 'warning',
  denied: 'danger',
  paid: 'success',
};

const CLAIM_INIT: ClaimFormData = {
  claimNumber: '', invoiceId: '', patientId: '', insuranceProvider: '',
  policyNumber: '', claimAmount: 0, approvedAmount: undefined, status: 'draft',
  submittedDate: '', resolvedDate: '', denialReason: '',
};

// ─── Number field handler helper ──────────────────────────────────────────────

function numVal(v: string): number { return v === '' ? 0 : Number(v); }

// ─── Invoices tab ─────────────────────────────────────────────────────────────

function nextInvoiceNumber(invoices: Invoice[]): string {
  const nums = invoices.map((i) => parseInt(i.invoiceNumber.replace(/\D/g, '') || '0', 10));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `INV-${new Date().getFullYear()}-${next}`;
}

function InvoicesTab() {
  const { data: invoices = [], isLoading, error } = useInvoices();
  const { data: orders = [] } = useOrders();
  const { data: patients = [] } = usePatients();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  const removeMutation = useRemoveInvoice();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState<InvoiceFormData>(INVOICE_INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const NUMERIC = ['totalAmount', 'amountPaid'] as const;
  const f = (field: keyof InvoiceFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const val = NUMERIC.includes(field as typeof NUMERIC[number]) ? numVal(e.target.value) : e.target.value;
    setFormData((p) => ({ ...p, [field]: val }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null);
    setFormData({ ...INVOICE_INIT, invoiceNumber: nextInvoiceNumber(invoices) });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setFormData({
      invoiceNumber: inv.invoiceNumber,
      orderId: inv.orderId,
      patientId: inv.patientId,
      totalAmount: inv.totalAmount,
      amountPaid: inv.amountPaid,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      insuranceClaimId: inv.insuranceClaimId ?? '',
      notes: inv.notes ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(invoiceFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      const payload = {
        ...v.data,
        insuranceClaimId: v.data.insuranceClaimId || undefined,
        notes: v.data.notes || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast.success('Invoice updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('Invoice created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!await confirm({ title: 'Delete invoice', message: `Delete ${inv.invoiceNumber}? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(inv.id);
      toast.success('Invoice deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const orderOptions = [
    { value: '', label: 'Select order…' },
    ...orders.map((o) => ({ value: o.id, label: `${o.orderNumber} — ${patients.find((p) => p.id === o.patientId)?.lastName ?? '?'}` })),
  ];

  const patientOptions = [
    { value: '', label: 'Select patient…' },
    ...patients.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName} (${p.mrn})` })),
  ];

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const patient = patients.find((p) => p.id === inv.patientId);
    const matchSearch = !q || `${inv.invoiceNumber} ${patient?.firstName} ${patient?.lastName} ${patient?.mrn}`.toLowerCase().includes(q);
    const matchStatus = !statusFilter || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by invoice # or patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          {INVOICE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Invoice</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-10 h-10" />}
            title="No invoices found"
            description={search || statusFilter ? 'Try adjusting your filters.' : 'Create your first invoice to get started.'}
            action={!search && !statusFilter ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Invoice</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Paid</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const patient = patients.find((p) => p.id === inv.patientId);
                  return (
                    <tr key={inv.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.invoiceNumber}</div>
                        <div className="text-xs text-foreground-muted">{formatDate(inv.issueDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground-muted hidden sm:table-cell">
                        {patient ? `${patient.lastName}, ${patient.firstName}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground hidden md:table-cell">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">{formatCurrency(inv.amountPaid)}</td>
                      <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant={INVOICE_BADGE[inv.status]} size="sm">{formatStatus(inv.status)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(inv)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? 'Edit Invoice' : 'New Invoice'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Invoice'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Invoice Number" value={formData.invoiceNumber} onChange={f('invoiceNumber')} required error={formErrors.invoiceNumber} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={INVOICE_STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Order" value={formData.orderId} onChange={f('orderId')} options={orderOptions} required error={formErrors.orderId} />
            <Select label="Patient" value={formData.patientId} onChange={f('patientId')} options={patientOptions} required error={formErrors.patientId} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Total Amount ($)" type="number" value={String(formData.totalAmount)} onChange={f('totalAmount')} required error={formErrors.totalAmount} />
            <Input label="Amount Paid ($)" type="number" value={String(formData.amountPaid)} onChange={f('amountPaid')} error={formErrors.amountPaid} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Issue Date" type="date" value={formData.issueDate} onChange={f('issueDate')} required error={formErrors.issueDate} />
            <Input label="Due Date" type="date" value={formData.dueDate} onChange={f('dueDate')} required error={formErrors.dueDate} />
          </div>
          <Textarea label="Notes" value={formData.notes ?? ''} onChange={f('notes')} rows={2} error={formErrors.notes} />
        </div>
      </Modal>
    </>
  );
}

// ─── Claims tab ───────────────────────────────────────────────────────────────

function nextClaimNumber(claims: InsuranceClaim[]): string {
  const nums = claims.map((c) => parseInt(c.claimNumber.replace(/\D/g, '') || '0', 10));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `CLM-${new Date().getFullYear()}-${next}`;
}

function ClaimsTab() {
  const { data: claims = [], isLoading, error } = useClaims();
  const { data: invoices = [] } = useInvoices();
  const { data: patients = [] } = usePatients();
  const createMutation = useCreateClaim();
  const updateMutation = useUpdateClaim();
  const removeMutation = useRemoveClaim();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InsuranceClaim | null>(null);
  const [formData, setFormData] = useState<ClaimFormData>(CLAIM_INIT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const NUMERIC = ['claimAmount', 'approvedAmount'] as const;
  const f = (field: keyof ClaimFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const isNum = NUMERIC.includes(field as typeof NUMERIC[number]);
    const val = isNum ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value;
    setFormData((p) => ({ ...p, [field]: val }));
    if (formErrors[field]) setFormErrors((p) => ({ ...p, [field]: '' }));
  };

  const openNew = () => {
    setEditing(null);
    setFormData({ ...CLAIM_INIT, claimNumber: nextClaimNumber(claims) });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const openEdit = (c: InsuranceClaim) => {
    setEditing(c);
    setFormData({
      claimNumber: c.claimNumber,
      invoiceId: c.invoiceId,
      patientId: c.patientId,
      insuranceProvider: c.insuranceProvider,
      policyNumber: c.policyNumber ?? '',
      claimAmount: c.claimAmount,
      approvedAmount: c.approvedAmount,
      status: c.status,
      submittedDate: c.submittedDate ?? '',
      resolvedDate: c.resolvedDate ?? '',
      denialReason: c.denialReason ?? '',
    });
    setFormErrors({}); setSubmitError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async () => {
    const v = validateForm(claimFormSchema, formData);
    if (v.success === false) { setFormErrors(v.errors); return; }
    setSubmitError('');
    try {
      const payload = {
        ...v.data,
        policyNumber: v.data.policyNumber || undefined,
        submittedDate: v.data.submittedDate || undefined,
        resolvedDate: v.data.resolvedDate || undefined,
        denialReason: v.data.denialReason || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast.success('Claim updated');
      } else {
        await createMutation.mutateAsync(payload as any);
        toast.success('Claim created');
      }
      closeModal();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleDelete = async (c: InsuranceClaim) => {
    if (!await confirm({ title: 'Delete claim', message: `Delete ${c.claimNumber}? This cannot be undone.`, confirmLabel: 'Delete' })) return;
    try {
      await removeMutation.mutateAsync(c.id);
      toast.success('Claim deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const invoiceOptions = [
    { value: '', label: 'Select invoice…' },
    ...invoices.map((inv) => ({ value: inv.id, label: inv.invoiceNumber })),
  ];

  const patientOptions = [
    { value: '', label: 'Select patient…' },
    ...patients.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName} (${p.mrn})` })),
  ];

  const filtered = claims.filter((c) => {
    const q = search.toLowerCase();
    const patient = patients.find((p) => p.id === c.patientId);
    const matchSearch = !q || `${c.claimNumber} ${c.insuranceProvider} ${patient?.firstName} ${patient?.lastName}`.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by claim # or provider…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          {CLAIM_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Claim</Button>
      </div>

      {error && <div className="mb-4"><Alert message={getErrorMessage(error)} /></div>}

      <Card>
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FilePlus className="w-10 h-10" />}
            title="No claims found"
            description={search || statusFilter ? 'Try adjusting your filters.' : 'Create your first insurance claim to get started.'}
            action={!search && !statusFilter ? <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Claim</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-subtle/50">
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted">Claim #</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Insurance Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Claim Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden md:table-cell">Approved</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden lg:table-cell">Submitted</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground-muted hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-card-hover transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.claimNumber}</div>
                      <div className="text-xs text-foreground-muted">{c.policyNumber ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden sm:table-cell">{c.insuranceProvider}</td>
                    <td className="px-4 py-3 text-foreground hidden md:table-cell">{formatCurrency(c.claimAmount)}</td>
                    <td className="px-4 py-3 text-foreground-muted hidden md:table-cell">
                      {c.approvedAmount !== undefined ? formatCurrency(c.approvedAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted hidden lg:table-cell">
                      {c.submittedDate ? formatDate(c.submittedDate) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={CLAIM_BADGE[c.status]} size="sm">{formatStatus(c.status)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-foreground-muted hover:text-danger transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        title={editing ? 'Edit Insurance Claim' : 'New Insurance Claim'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isBusy}>{editing ? 'Save Changes' : 'Create Claim'}</Button>
          </>
        }
      >
        {submitError && <div className="mb-4"><Alert message={submitError} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Claim Number" value={formData.claimNumber} onChange={f('claimNumber')} required error={formErrors.claimNumber} />
            <Select label="Status" value={formData.status} onChange={f('status')} options={CLAIM_STATUS_OPTIONS} required error={formErrors.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Invoice" value={formData.invoiceId} onChange={f('invoiceId')} options={invoiceOptions} required error={formErrors.invoiceId} />
            <Select label="Patient" value={formData.patientId} onChange={f('patientId')} options={patientOptions} required error={formErrors.patientId} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Insurance Provider" value={formData.insuranceProvider} onChange={f('insuranceProvider')} required error={formErrors.insuranceProvider} />
            <Input label="Policy Number" value={formData.policyNumber ?? ''} onChange={f('policyNumber')} error={formErrors.policyNumber} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Claim Amount ($)" type="number" value={formData.claimAmount !== undefined ? String(formData.claimAmount) : ''} onChange={f('claimAmount')} required error={formErrors.claimAmount} />
            <Input label="Approved Amount ($)" type="number" value={formData.approvedAmount !== undefined ? String(formData.approvedAmount) : ''} onChange={f('approvedAmount')} error={formErrors.approvedAmount} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Submitted Date" type="date" value={formData.submittedDate ?? ''} onChange={f('submittedDate')} error={formErrors.submittedDate} />
            <Input label="Resolved Date" type="date" value={formData.resolvedDate ?? ''} onChange={f('resolvedDate')} error={formErrors.resolvedDate} />
          </div>
          <Input label="Denial Reason" value={formData.denialReason ?? ''} onChange={f('denialReason')} placeholder="If denied, provide reason" error={formErrors.denialReason} />
        </div>
      </Modal>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'invoices' | 'claims';

export default function Billing() {
  const [activeTab, setActiveTab] = useState<Tab>('invoices');

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-foreground-muted text-sm mt-0.5">Manage invoices and insurance claims</p>
      </div>

      <div className="flex gap-1 p-1 bg-background-subtle rounded-lg mb-6 w-fit">
        {([['invoices', 'Invoices', Receipt], ['claims', 'Insurance Claims', FilePlus]] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'invoices' ? <InvoicesTab /> : <ClaimsTab />}
    </div>
  );
}
