import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { useGrants, useCreateGrant, useUpdateGrant, useDeleteGrant } from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { grantFormSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency, formatDateForInput } from '../lib/utils';
import type { Grant } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState,
  PageError, StatCard, AnimatedNumber, ConfirmDialog, SkeletonStatRow, Skeleton, Tabs,
} from '../components/ui';
import { m, AnimatePresence, staggerContainer, fadeInUp, EASE_LUX } from '../lib/motion';
import { Plus, Search, DollarSign, Calendar, ExternalLink, Gift, Edit, Trash2, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';

type GrantStatus = Grant['status'];

/** Pipeline column order; denied sits outside the happy path. */
const PIPELINE: { status: GrantStatus; label: string }[] = [
  { status: 'available', label: 'Available' },
  { status: 'applied', label: 'Applied' },
  { status: 'approved', label: 'Approved' },
  { status: 'received', label: 'Received' },
  { status: 'denied', label: 'Denied' },
];

const NEXT_STATUS: Partial<Record<GrantStatus, { to: GrantStatus; label: string }>> = {
  available: { to: 'applied', label: 'Mark applied' },
  applied: { to: 'approved', label: 'Mark approved' },
  approved: { to: 'received', label: 'Mark received' },
};

/** Deadline chip: red inside a week, amber inside a month, danger when past. */
function DeadlineBadge({ deadline }: { deadline: string }) {
  const daysLeft = differenceInCalendarDays(parseISO(deadline), new Date());
  if (daysLeft < 0) return <Badge variant="danger" size="sm">overdue</Badge>;
  if (daysLeft <= 7) return <Badge variant="danger" size="sm">{daysLeft === 0 ? 'due today' : `${daysLeft}d left`}</Badge>;
  if (daysLeft <= 30) return <Badge variant="warning" size="sm">{daysLeft}d left</Badge>;
  return null;
}

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
  // Server-side RLS is what enforces these; hiding the controls just avoids
  // offering an action that would be refused. See `lib/permissions`.
  const { can } = useAuth();
  const canCreate = can('create');
  const canEdit = can('update');
  const canDelete = can('delete');

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
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  // Seeded from ?q= so the command palette can deep-link a specific grant
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [view, setView] = useState<'list' | 'pipeline'>('list');
  const [deleteTarget, setDeleteTarget] = useState<Grant | null>(null);
  /** Grant id currently wearing the one-shot gold shimmer (just marked received). */
  const [shimmerId, setShimmerId] = useState<string | null>(null);
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

  // Headline totals are computed over ALL grants, not the filtered view —
  // filters narrow the list below, they must not move the headline numbers.
  const totals = useMemo(() => {
    const sumFor = (status: GrantStatus) =>
      grants.filter(g => g.amount && g.status === status).reduce((sum, g) => sum + (g.amount || 0), 0);
    const countFor = (status: GrantStatus) => grants.filter(g => g.status === status).length;
    return {
      available: sumFor('available'), availableCount: countFor('available'),
      applied: sumFor('applied'), appliedCount: countFor('applied'),
      approved: sumFor('approved'), approvedCount: countFor('approved'),
      received: sumFor('received'), receivedCount: countFor('received'),
    };
  }, [grants]);

  const handleEdit = (grant: Grant) => {
    setEditingGrant(grant);
    // Spread `initialFormData` first: `reset` replaces wholesale rather than
    // merging, so any field not seeded here would land as `undefined`. It also
    // clears `errors`/`touched`, which `setValues` did not — so a failed create
    // used to leave its complaints on top of the record being edited.
    form.reset({
      ...initialFormData,
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

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  /** Click-to-advance a grant along the pipeline. Receiving earns a single gold shimmer. */
  const advance = (grant: Grant, to: GrantStatus) => {
    updateMutation.mutate(
      { id: grant.id, status: to },
      {
        onSuccess: () => {
          if (to === 'received') {
            setShimmerId(grant.id);
            setTimeout(() => setShimmerId(null), 1200);
          }
        },
      }
    );
  };

  const resetForm = () => form.reset(initialFormData);

  // Every path in or out of the modal goes through these, so the form cannot be
  // left holding a previous session's values or validation errors.
  const handleOpenCreate = () => {
    resetForm();
    setEditingGrant(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGrant(null);
    resetForm();
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
          {canCreate && (
            <Button
              variant="primary"
              icon={<Plus size={20} />}
              onClick={handleOpenCreate}
            >
              Add Grant
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      <PageError error={combinedError} />

      {/* Stats Cards — totals over all grants, unaffected by the filters below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Available Funding"
          value={<AnimatedNumber to={totals.available} format={formatCurrency} />}
          icon={Gift} tone="info"
          hint={`${totals.availableCount} open`}
        />
        <StatCard
          label="Applied For"
          value={<AnimatedNumber to={totals.applied} format={formatCurrency} />}
          icon={Calendar} tone="warning"
          hint={`${totals.appliedCount} pending`}
        />
        <StatCard
          label="Approved"
          value={<AnimatedNumber to={totals.approved} format={formatCurrency} />}
          icon={CheckCircle2} tone="primary"
          hint={`${totals.approvedCount} awaiting funds`}
        />
        <StatCard
          label="Received"
          value={<AnimatedNumber to={totals.received} format={formatCurrency} />}
          icon={DollarSign} tone="success"
          hint={`${totals.receivedCount} funded`}
        />
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground-muted whitespace-nowrap">
                {filteredGrants.length} of {grants.length}
              </span>
              <Tabs
                tabs={[{ value: 'list', label: 'List' }, { value: 'pipeline', label: 'Pipeline' }]}
                active={view}
                onChange={(v) => setView(v as 'list' | 'pipeline')}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <SkeletonStatRow count={4} />
          {[0, 1, 2].map(i => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <Skeleton className="h-4 w-72" />
              </CardBody>
            </Card>
          ))}
        </div>
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
              action={canCreate ? (
                <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>
                  Add Grant
                </Button>
              ) : undefined}
            />
          </CardBody>
        </Card>
      )}

      {!isLoading && filteredGrants.length > 0 && view === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {PIPELINE.map(col => {
            const colGrants = filteredGrants.filter(g => g.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">{col.label}</h3>
                  <Badge variant="secondary" size="sm">{colGrants.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[60px] rounded-xl">
                  <AnimatePresence mode="popLayout">
                    {colGrants.map(grant => {
                      const next = NEXT_STATUS[grant.status];
                      return (
                        <m.div
                          key={grant.id}
                          layoutId={`grant-${grant.id}`}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.3, ease: EASE_LUX }}
                          className={`relative overflow-hidden bg-card border border-border rounded-xl shadow-sm p-3.5 ${
                            shimmerId === grant.id ? 'gold-shimmer' : ''
                          }`}
                        >
                          <button
                            onClick={() => handleEdit(grant)}
                            className="block w-full text-left min-h-0"
                          >
                            <p className="text-sm font-semibold text-foreground leading-snug">{grant.title}</p>
                            <p className="text-xs text-foreground-muted mt-1 truncate">{grant.source}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {grant.amount ? (
                                <span className="text-sm font-semibold text-foreground">{formatCurrency(grant.amount)}</span>
                              ) : null}
                              {grant.deadline && grant.status !== 'received' && grant.status !== 'denied' && (
                                <DeadlineBadge deadline={grant.deadline} />
                              )}
                            </div>
                          </button>
                          {next && canEdit && (
                            <button
                              onClick={() => advance(grant, next.to)}
                              disabled={updateMutation.isPending}
                              className="mt-2.5 w-full min-h-0 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover border border-border hover:border-primary rounded-lg py-1.5 transition-colors disabled:opacity-50"
                            >
                              {next.label}
                              <ArrowRight size={12} />
                            </button>
                          )}
                        </m.div>
                      );
                    })}
                  </AnimatePresence>
                  {colGrants.length === 0 && (
                    <div className="border border-dashed border-border rounded-xl py-6 text-center text-xs text-foreground-subtle">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredGrants.length > 0 && view === 'list' && (
        <m.div className="grid gap-4" variants={staggerContainer} initial="hidden" animate="show">
          {filteredGrants.map((grant) => (
            <m.div
              key={grant.id}
              variants={fadeInUp}
              className={`relative overflow-hidden rounded-xl ${shimmerId === grant.id ? 'gold-shimmer' : ''}`}
            >
            <Card hoverable>
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
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          <span>Deadline: {format(new Date(grant.deadline), 'MMM d, yyyy')}</span>
                          {grant.status !== 'received' && grant.status !== 'denied' && (
                            <DeadlineBadge deadline={grant.deadline} />
                          )}
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
                      {NEXT_STATUS[grant.status] && canEdit && (
                        <button
                          onClick={() => advance(grant, NEXT_STATUS[grant.status]!.to)}
                          disabled={updateMutation.isPending}
                          className="p-1.5 text-foreground-muted hover:text-success hover:bg-success-50 dark:hover:bg-success-950 rounded-lg transition-colors disabled:opacity-50"
                          title={NEXT_STATUS[grant.status]!.label}
                        >
                          <ArrowRight size={16} />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(grant)}
                          className="p-1.5 text-foreground-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(grant)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-foreground-muted hover:text-danger hover:bg-danger-50 dark:hover:bg-danger-950 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
            </m.div>
          ))}
        </m.div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
        title="Delete grant"
        message={
          <>Permanently remove <span className="font-medium text-foreground">{deleteTarget?.title}</span>? This cannot be undone.</>
        }
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingGrant ? 'Edit Grant/Opportunity' : 'Add New Grant/Opportunity'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>
              Cancel
            </Button>
            {(editingGrant ? canEdit : canCreate) && (
              <Button
                variant="primary"
                onClick={() => form.handleSubmit()}
                loading={isMutating}
              >
                {editingGrant ? 'Update' : 'Add'}
              </Button>
            )}
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
