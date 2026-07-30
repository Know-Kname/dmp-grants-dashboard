import { useState, useMemo } from 'react';
import type { z } from 'zod';
import { useGrants, useCreateGrant, useUpdateGrant, useDeleteGrant } from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { grantFormSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency, formatDateForInput } from '../lib/utils';
import type { Grant } from '../types';
import { Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState, LoadingSpinner, PageError, StatCard } from '../components/ui';
import { Plus, Search, DollarSign, Calendar, ExternalLink, Gift, Edit, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../lib/toast';

/**
 * Live form state — the *input* side of `grantFormSchema`.
 *
 * Derived from the schema rather than hand-declared so the two cannot drift.
 * Note it is not the same as the schema's output: `amount` is typed as a string
 * here (what an `<input>` gives you) and becomes a number once parsed.
 */
type GrantFormData = z.input<typeof grantFormSchema>;

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

  // Local state
  const [showModal, setShowModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  // Form state + validation. `onSubmit` only runs once grantFormSchema parses,
  // so `data` here is the *output* shape — amount has already been coerced from
  // its input string to a number.
  const form = useForm({
    schema: grantFormSchema,
    initialValues: initialFormData,
    onSubmit: (data) => {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        type: data.type,
        source: data.source,
        amount: data.amount,
        deadline: data.deadline || undefined,
        status: data.status,
        applicationDate: data.applicationDate || undefined,
        notes: data.notes || undefined,
      };

      if (editingGrant) {
        updateMutation.mutate({ id: editingGrant.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

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

  const handleEdit = (grant: Grant) => {
    setEditingGrant(grant);
    form.setValues({
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

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this grant/opportunity?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => form.reset(initialFormData);

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
      <PageError error={combinedError} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Available Funding" value={formatCurrency(totals.available)} icon={Gift} tone="info" />
        <StatCard label="Applied For" value={formatCurrency(totals.applied)} icon={Calendar} tone="warning" />
        <StatCard label="Received" value={formatCurrency(totals.received)} icon={DollarSign} tone="success" />
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
                          <span>Deadline: {format(new Date(grant.deadline), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {grant.applicationDate && (
                        <div className="text-xs">
                          Applied: {format(new Date(grant.applicationDate), 'MMM d, yyyy')}
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
              onClick={() => form.handleSubmit()}
              loading={isMutating}
            >
              {editingGrant ? 'Update' : 'Add'}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <Input
            label="Title"
            {...form.getFieldProps('title')}
            error={getFieldError('title', form.errors, form.touched)}
            required
          />
          <Textarea
            label="Description"
            {...form.getFieldProps('description')}
            error={getFieldError('description', form.errors, form.touched)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              {...form.getFieldProps('type')}
              error={getFieldError('type', form.errors, form.touched)}
              options={[
                { value: 'grant', label: 'Grant' },
                { value: 'benefit', label: 'Benefit' },
                { value: 'opportunity', label: 'Opportunity' },
              ]}
            />
            <Select
              label="Status"
              {...form.getFieldProps('status')}
              error={getFieldError('status', form.errors, form.touched)}
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
            {...form.getFieldProps('source')}
            error={getFieldError('source', form.errors, form.touched)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              {...form.getFieldProps('amount')}
              error={getFieldError('amount', form.errors, form.touched)}
              placeholder="0.00"
            />
            <Input
              label="Deadline"
              type="date"
              {...form.getFieldProps('deadline')}
              error={getFieldError('deadline', form.errors, form.touched)}
            />
          </div>
          <Input
            label="Application Date"
            type="date"
            {...form.getFieldProps('applicationDate')}
            error={getFieldError('applicationDate', form.errors, form.touched)}
          />
          <Textarea
            label="Notes"
            {...form.getFieldProps('notes')}
            error={getFieldError('notes', form.errors, form.touched)}
          />
        </form>
      </Modal>
    </div>
  );
}
