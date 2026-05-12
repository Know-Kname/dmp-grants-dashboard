import { useState, useMemo } from 'react';
import { useGrants, useCreateGrant, useUpdateGrant, useDeleteGrant } from '../hooks/useData';
import { getErrorDetails, getErrorMessage, getErrorRequestId } from '../lib/errors';
import { formatCurrency, formatDateForInput, parseDateStr } from '../lib/utils';
import { Grant } from '../types';
import { Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState, LoadingSpinner } from '../components/ui';
import { Plus, Search, DollarSign, Calendar, ExternalLink, Gift, Edit, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

type GrantFormData = {
  title: string;
  description: string;
  type: 'grant' | 'benefit' | 'opportunity';
  source: string;
  amount: string;
  deadline: string;
  status: 'available' | 'applied' | 'approved' | 'denied' | 'received';
  applicationDate: string;
  notes: string;
};

const initialFormData: GrantFormData = {
  title: '',
  description: '',
  type: 'grant',
  source: '',
  amount: '',
  deadline: '',
  status: 'available',
  applicationDate: '',
  notes: '',
};

export default function Grants() {
  // React Query hooks
  const { data: grants = [], isLoading, error, refetch } = useGrants();
  const toast = useToast();

  const createMutation = useCreateGrant({
    onSuccess: () => { toast.success('Grant added successfully'); setShowModal(false); resetForm(); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to save grant'),
  });

  const updateMutation = useUpdateGrant({
    onSuccess: () => { toast.success('Grant updated'); setShowModal(false); setEditingGrant(null); resetForm(); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update grant'),
  });

  const deleteMutation = useDeleteGrant({
    onSuccess: () => toast.success('Grant removed'),
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete'),
  });

  const { confirm } = useConfirm();

  // Local state
  const [showModal, setShowModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formData, setFormData] = useState<GrantFormData>(initialFormData);

  // Filter grants using useMemo for performance
  const filteredGrants = useMemo(() => {
    let filtered = grants;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.title.toLowerCase().includes(search) ||
        g.description?.toLowerCase().includes(search) ||
        g.source?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(g => g.type === typeFilter);
    }

    return filtered;
  }, [grants, searchTerm, statusFilter, typeFilter]);

  // Calculate totals using useMemo
  const totals = useMemo(() => ({
    available: filteredGrants
      .filter(g => g.amount && g.status === 'available')
      .reduce((sum, g) => sum + (g.amount || 0), 0),
    applied: filteredGrants
      .filter(g => g.amount && g.status === 'applied')
      .reduce((sum, g) => sum + (g.amount || 0), 0),
    received: filteredGrants
      .filter(g => g.amount && g.status === 'received')
      .reduce((sum, g) => sum + (g.amount || 0), 0),
  }), [filteredGrants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      title: formData.title,
      description: formData.description || undefined,
      type: formData.type,
      source: formData.source,
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      deadline: formData.deadline || undefined,
      status: formData.status,
      applicationDate: formData.applicationDate || undefined,
      notes: formData.notes || undefined,
    };

    if (editingGrant) {
      updateMutation.mutate({ id: editingGrant.id, ...payload });
    } else {
      createMutation.mutate(payload as Omit<Grant, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>);
    }
  };

  const handleEdit = (grant: Grant) => {
    setEditingGrant(grant);
    setFormData({
      title: grant.title,
      description: grant.description || '',
      type: grant.type,
      source: grant.source,
      amount: grant.amount?.toString() || '',
      deadline: grant.deadline ? formatDateForInput(grant.deadline) : '',
      status: grant.status,
      applicationDate: grant.applicationDate ? formatDateForInput(grant.applicationDate) : '',
      notes: grant.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (await confirm('Delete this grant/opportunity? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
      available: 'info',
      applied: 'warning',
      approved: 'success',
      denied: 'danger',
      received: 'primary',
    };
    return <Badge variant={variants[status]} dot>{status.replace('_', ' ')}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'primary' | 'success' | 'info'> = {
      grant: 'primary',
      benefit: 'success',
      opportunity: 'info',
    };
    return <Badge variant={variants[type]} size="sm">{type}</Badge>;
  };

  // Combine mutation errors
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error;
  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const combinedError = error || mutationError;
  const errorDetails = combinedError ? getErrorDetails(combinedError) : [];
  const errorRequestId = combinedError ? getErrorRequestId(combinedError) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grants & Opportunities</h1>
          <p className="text-foreground-muted mt-1">Track funding opportunities and veteran benefits</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            icon={<RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={20} />}
            onClick={() => {
              resetForm();
              setEditingGrant(null);
              setShowModal(true);
            }}
          >
            Add Grant
          </Button>
        </div>
      </div>

      {/* Error display */}
      {combinedError && (
        <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-danger shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-danger">Error</h3>
            <p className="text-sm text-danger-700 dark:text-danger-400">
              {getErrorMessage(combinedError)}
            </p>
            {(errorDetails.length > 0 || errorRequestId) && (
              <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 list-disc pl-5 space-y-1">
                {errorDetails.map((detail, index) => (
                  <li key={`${detail}-${index}`}>{detail}</li>
                ))}
                {errorRequestId && <li>Request ID: {errorRequestId}</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Available Funding</p>
                <p className="text-2xl font-bold text-info">{formatCurrency(totals.available)}</p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-950 rounded-lg">
                <Gift className="text-info" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Applied For</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(totals.applied)}</p>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-950 rounded-lg">
                <Calendar className="text-warning" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Received</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totals.received)}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search grants..."
              icon={<Search size={18} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'grant', label: 'Grants' },
                { value: 'benefit', label: 'Benefits' },
                { value: 'opportunity', label: 'Opportunities' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
            <Select
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'available', label: 'Available' },
                { value: 'applied', label: 'Applied' },
                { value: 'approved', label: 'Approved' },
                { value: 'denied', label: 'Denied' },
                { value: 'received', label: 'Received' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <div className="flex items-center text-sm text-foreground-muted">
              {filteredGrants.length} of {grants.length} grants
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardBody>
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-foreground-muted mt-4">Loading grants...</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Grants List */}
      {!isLoading && filteredGrants.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Gift size={48} />}
              title="No grants found"
              description={searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                ? "Try adjusting your filters"
                : "Add your first grant or funding opportunity"}
              action={
                <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>
                  Add Grant
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {!isLoading && filteredGrants.length > 0 && (
        <div className="grid gap-4">
          {filteredGrants.map((grant) => (
            <Card key={grant.id} hoverable className="animate-fade-in">
              <CardBody>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-foreground">{grant.title}</h3>
                      {getTypeBadge(grant.type)}
                    </div>
                    {grant.description && (
                      <p className="text-foreground-muted mb-3 line-clamp-2">{grant.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-muted">
                      <div className="flex items-center gap-1">
                        <ExternalLink size={14} />
                        <span className="font-medium">{grant.source}</span>
                      </div>
                      {grant.amount && (
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} />
                          <span className="font-semibold text-foreground">
                            {formatCurrency(grant.amount)}
                          </span>
                        </div>
                      )}
                      {grant.deadline && (
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>Deadline: {format(parseDateStr(grant.deadline), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {grant.applicationDate && (
                        <div className="text-xs">
                          Applied: {format(parseDateStr(grant.applicationDate), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                    {grant.notes && (
                      <div className="mt-3 p-3 bg-background-muted rounded-lg">
                        <p className="text-sm text-foreground-muted">{grant.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-3 ml-4 shrink-0">
                    {getStatusBadge(grant.status)}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(grant)}
                        className="p-1.5 text-foreground-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(grant.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-foreground-muted hover:text-danger hover:bg-danger-50 dark:hover:bg-danger-950 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingGrant(null);
          resetForm();
        }}
        title={editingGrant ? 'Edit Grant/Opportunity' : 'Add New Grant/Opportunity'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isMutating}
            >
              {editingGrant ? 'Update' : 'Add'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as GrantFormData['type'] })}
              options={[
                { value: 'grant', label: 'Grant' },
                { value: 'benefit', label: 'Benefit' },
                { value: 'opportunity', label: 'Opportunity' },
              ]}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as GrantFormData['status'] })}
              options={[
                { value: 'available', label: 'Available' },
                { value: 'applied', label: 'Applied' },
                { value: 'approved', label: 'Approved' },
                { value: 'denied', label: 'Denied' },
                { value: 'received', label: 'Received' },
              ]}
            />
          </div>
          <Input
            label="Source/Organization"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
            <Input
              label="Deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>
          <Input
            label="Application Date"
            type="date"
            value={formData.applicationDate}
            onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
