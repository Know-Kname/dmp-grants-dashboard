import { useState, useMemo } from 'react';
import {
  useContracts, useCreateContract,
  useUpdateContract, useDeleteContract,
} from '../hooks/useData';
import { getErrorMessage, getErrorDetails, getErrorRequestId } from '../lib/errors';
import { formatCurrency, formatDate, formatDateForInput, cn } from '../lib/utils';
import type { Contract } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select,
  Badge, EmptyState, LoadingSpinner,
} from '../components/ui';
import {
  Plus, Search, FileText, Edit, Trash2,
  AlertCircle, RefreshCw, DollarSign, TrendingUp,
} from 'lucide-react';
import { useToast } from '../lib/toast';

type ContractFormData = {
  contractNumber: string;
  type: Contract['type'];
  customerId: string;
  totalAmount: string;
  signedDate: string;
  status: Contract['status'];
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

export default function Contracts() {
  const { data: contracts = [], isLoading, error, refetch } = useContracts();

  const toast = useToast();
  const createMutation = useCreateContract({
    onSuccess: () => { toast.success('Contract created'); setShowModal(false); setFormData(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to create contract'),
  });
  const updateMutation = useUpdateContract({
    onSuccess: () => { toast.success('Contract updated'); setShowModal(false); setEditingContract(null); setFormData(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update contract'),
  });
  const deleteMutation = useDeleteContract({
    onSuccess: () => toast.success('Contract removed'),
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formData, setFormData] = useState<ContractFormData>(initialForm);

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
  const errorDetails = combinedError ? getErrorDetails(combinedError) : [];
  const errorRequestId = combinedError ? getErrorRequestId(combinedError) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      contractNumber: formData.contractNumber,
      type: formData.type,
      customerId: formData.customerId,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      amountPaid: editingContract ? editingContract.amountPaid : 0,
      signedDate: formData.signedDate,
      status: formData.status,
      items: editingContract ? editingContract.items : [],
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
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this contract? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const f = (field: keyof ContractFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

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
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setFormData(initialForm); setEditingContract(null); setShowModal(true); }}>
            New Contract
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total Contracts</p>
                <p className="text-2xl font-bold text-info">{stats.total}</p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-950 rounded-lg">
                <FileText className="text-info" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Active</p>
                <p className="text-2xl font-bold text-success">{stats.active}</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <TrendingUp className="text-success" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total Value</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalValue)}</p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
                <DollarSign className="text-primary" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Received</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(stats.amountReceived)}</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <DollarSign className="text-success" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters + Status Tabs */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search by contract # or customer ID..."
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
          {/* PandaDoc-style pill status tabs */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Contract #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">Signed</th>
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
                      <td className="px-6 py-4 text-foreground-muted">{c.customerId}</td>
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
        onClose={() => { setShowModal(false); setEditingContract(null); }}
        title={editingContract ? 'Edit Contract' : 'New Contract'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={isMutating} onClick={handleSubmit}>
              {editingContract ? 'Save Changes' : 'Create Contract'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
            <Input label="Customer ID" value={formData.customerId} onChange={f('customerId')} required />
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
          <div className="grid grid-cols-2 gap-4">
            <Input label="Total Amount ($)" type="number" min="0" step="0.01" value={formData.totalAmount} onChange={f('totalAmount')} required />
            <Input label="Signed Date" type="date" value={formData.signedDate} onChange={f('signedDate')} required />
          </div>
        </form>
      </Modal>
    </div>
  );
}
