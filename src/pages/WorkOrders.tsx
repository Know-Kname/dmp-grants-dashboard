import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import {
  useWorkOrders, useCreateWorkOrder,
  useUpdateWorkOrder, useDeleteWorkOrder,
} from '../hooks/useData';
import { useForm, getFieldError } from '../hooks/useForm';
import { workOrderFormSchema } from '../lib/schemas';
import { getErrorMessage } from '../lib/errors';
import { useToast } from '../lib/toast';
import type { WorkOrder } from '../types';
import {
  PageHeader, Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState,
  PageError, StatCard, TABLE_HEAD_CLASS, ConfirmDialog, SkeletonTable, Tabs,
} from '../components/ui';
import { m, AnimatePresence, EASE_LUX } from '../lib/motion';
import { Plus, Search, Edit, Trash2, ClipboardList, Calendar, RefreshCw, AlertCircle, ArrowRight, User } from 'lucide-react';
import { format, isThisMonth, startOfDay } from 'date-fns';
import { useAuth } from '../lib/auth';

/** Left color rail per priority on kanban cards. */
const PRIORITY_RAIL: Record<WorkOrder['priority'], string> = {
  low: 'border-l-slate-300 dark:border-l-slate-600',
  medium: 'border-l-info',
  high: 'border-l-warning',
  urgent: 'border-l-danger',
};

const BOARD_COLUMNS: { status: WorkOrder['status']; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
  { status: 'cancelled', label: 'Cancelled' },
];

const NEXT_STATUS: Partial<Record<WorkOrder['status'], { to: WorkOrder['status']; label: string }>> = {
  pending: { to: 'in_progress', label: 'Start' },
  in_progress: { to: 'completed', label: 'Complete' },
};

function isOverdue(wo: WorkOrder): boolean {
  return Boolean(
    wo.dueDate &&
    (wo.status === 'pending' || wo.status === 'in_progress') &&
    new Date(wo.dueDate) < startOfDay(new Date())
  );
}

/** Live form state — the input side of `workOrderFormSchema`, so the two cannot drift. */
type WorkOrderFormData = z.input<typeof workOrderFormSchema>;

const initialForm: WorkOrderFormData = {
  title: '',
  description: '',
  type: 'maintenance',
  priority: 'medium',
  assignedTo: '',
  dueDate: '',
};

const STATUS_VARIANTS: Record<WorkOrder['status'], 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const PRIORITY_VARIANTS: Record<WorkOrder['priority'], 'secondary' | 'info' | 'warning' | 'danger'> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

const TYPE_OPTIONS = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'burial_prep', label: 'Burial Prep' },
  { value: 'grounds', label: 'Grounds' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function WorkOrders() {
  const { data: workOrders = [], isLoading, error, refetch } = useWorkOrders();
  const toast = useToast();

  const createMutation = useCreateWorkOrder({
    onSuccess: () => { toast.success('Work order created successfully'); setShowModal(false); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to create work order'),
  });
  const updateMutation = useUpdateWorkOrder({
    onSuccess: () => { toast.success('Work order updated'); setShowModal(false); setEditingOrder(null); form.reset(initialForm); },
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to update work order'),
  });
  const deleteMutation = useDeleteWorkOrder({
    onSuccess: () => toast.success('Work order removed'),
    onError: (err) => toast.error(getErrorMessage(err), 'Failed to delete work order'),
  });

  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'table' | 'board'>('table');
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);

  // Write permissions. Postgres RLS is what enforces them (every policy keys off
  // `profiles.role`); hiding the controls only stops the UI offering an action
  // the server would refuse. See `lib/permissions`.
  const { can } = useAuth();
  const canCreate = can('create');
  const canEdit = can('update');
  const canDelete = can('delete');

  // Form state + validation. onSubmit only runs once the schema parses.
  const form = useForm({
    schema: workOrderFormSchema,
    initialValues: initialForm,
    onSubmit: (data) => {
      const payload = {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        assignedTo: data.assignedTo || undefined,
        dueDate: data.dueDate || undefined,
      };
      if (editingOrder) {
        updateMutation.mutate({ id: editingOrder.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const stats = useMemo(() => ({
    total: workOrders.length,
    open: workOrders.filter(wo => wo.status === 'pending' || wo.status === 'in_progress').length,
    thisMonth: workOrders.filter(wo => {
      try { return isThisMonth(new Date(wo.createdAt)); } catch { return false; }
    }).length,
  }), [workOrders]);

  const filteredOrders = useMemo(() => {
    let result = workOrders;
    if (statusFilter !== 'all') result = result.filter(wo => wo.status === statusFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(wo =>
        wo.title.toLowerCase().includes(s) ||
        wo.description?.toLowerCase().includes(s) ||
        wo.assignedTo?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [workOrders, searchTerm, statusFilter]);

  const combinedError = error || createMutation.error || updateMutation.error || deleteMutation.error;


  // Every path that opens the modal normalises the form first. `reset` sets
  // values *and* clears `errors`/`touched`; `setValues` cleared neither, so a
  // failed create used to leave its complaints on whatever opened next.
  const handleOpenCreate = () => {
    form.reset(initialForm);
    setEditingOrder(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    form.reset(initialForm);
  };

  const handleEdit = (wo: WorkOrder) => {
    setEditingOrder(wo);
    // Spread `initialForm` first: `reset` replaces wholesale rather than
    // merging, so any field not seeded here would land as `undefined`.
    form.reset({
      ...initialForm,
      title: wo.title,
      description: wo.description || '',
      type: wo.type,
      priority: wo.priority,
      assignedTo: wo.assignedTo || '',
      dueDate: wo.dueDate ? format(new Date(wo.dueDate), 'yyyy-MM-dd') : '',
    });
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const moveTo = (wo: WorkOrder, to: WorkOrder['status']) => {
    updateMutation.mutate({ id: wo.id, status: to });
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Orders"
        subtitle="Manage and track maintenance and service tasks"
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
              Refresh
            </Button>
            {canCreate && (
              <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>
                New Work Order
              </Button>
            )}
          </>
        }
      />

      <PageError error={combinedError} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Orders" value={stats.total.toLocaleString()} icon={ClipboardList} tone="primary" />
        <StatCard label="Open / In Progress" value={stats.open} icon={AlertCircle} tone="warning" />
        <StatCard label="Created This Month" value={stats.thisMonth} icon={Calendar} tone="info" />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search work orders…"
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="sm:w-48">
              <Select
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
            <p className="text-sm text-foreground-muted self-center whitespace-nowrap">
              {filteredOrders.length} of {workOrders.length}
            </p>
            <Tabs
              tabs={[{ value: 'table', label: 'Table' }, { value: 'board', label: 'Board' }]}
              active={view}
              onChange={(v) => setView(v as 'table' | 'board')}
            />
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList size={48} />}
              title="No work orders found"
              description={searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first work order to get started'}
              action={canCreate && 
                <Button variant="primary" icon={<Plus size={20} />} onClick={handleOpenCreate}>
                  New Work Order
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {BOARD_COLUMNS.map(col => {
            const colOrders = filteredOrders.filter(wo => wo.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">{col.label}</h3>
                  <Badge variant={STATUS_VARIANTS[col.status]} size="sm">{colOrders.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[60px]">
                  <AnimatePresence mode="popLayout">
                    {colOrders.map(wo => {
                      const next = NEXT_STATUS[wo.status];
                      const overdue = isOverdue(wo);
                      return (
                        <m.div
                          key={wo.id}
                          layoutId={`wo-${wo.id}`}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.3, ease: EASE_LUX }}
                          className={`bg-card border border-border border-l-4 ${PRIORITY_RAIL[wo.priority]} rounded-xl shadow-sm p-3.5`}
                        >
                          <button onClick={() => handleEdit(wo)} className="block w-full text-left min-h-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground leading-snug">{wo.title}</p>
                              <Badge variant={PRIORITY_VARIANTS[wo.priority]} size="sm">{wo.priority}</Badge>
                            </div>
                            {wo.description && (
                              <p className="text-xs text-foreground-muted mt-1 line-clamp-2">{wo.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-foreground-muted flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <User size={11} />
                                {wo.assignedTo || 'Unassigned'}
                              </span>
                              {wo.dueDate && (
                                <span className={`inline-flex items-center gap-1 ${overdue ? 'text-danger font-medium' : ''}`}>
                                  <Calendar size={11} />
                                  {format(new Date(wo.dueDate), 'MMM d')}
                                  {overdue && ' · overdue'}
                                </span>
                              )}
                            </div>
                          </button>
                          {next && canEdit && (
                            <button
                              onClick={() => moveTo(wo, next.to)}
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
                  {colOrders.length === 0 && (
                    <div className="border border-dashed border-border rounded-xl py-6 text-center text-xs text-foreground-subtle">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-subtle border-b border-border">
                <tr>
                  <th className={TABLE_HEAD_CLASS}>Work Order</th>
                  <th className={TABLE_HEAD_CLASS}>Type</th>
                  <th className={TABLE_HEAD_CLASS}>Priority</th>
                  <th className={TABLE_HEAD_CLASS}>Status</th>
                  <th className={TABLE_HEAD_CLASS}>Assigned To</th>
                  <th className={TABLE_HEAD_CLASS}>Due Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{wo.title}</div>
                      {wo.description && (
                        <div className="text-sm text-foreground-muted truncate max-w-xs">{wo.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground capitalize">
                      {wo.type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={PRIORITY_VARIANTS[wo.priority]} size="sm">{wo.priority}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANTS[wo.status]}>{wo.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {wo.assignedTo || <span className="text-foreground-subtle">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {wo.dueDate ? (
                        <div className={`flex items-center gap-1.5 ${isOverdue(wo) ? 'text-danger font-medium' : 'text-foreground-muted'}`}>
                          <Calendar size={14} />
                          {format(new Date(wo.dueDate), 'MMM d, yyyy')}
                          {isOverdue(wo) && <Badge variant="danger" size="sm">overdue</Badge>}
                        </div>
                      ) : <span className="text-foreground-muted">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button onClick={() => handleEdit(wo)} className="text-primary hover:text-primary-hover transition-colors" aria-label="Edit">
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(wo)} className="text-danger hover:text-danger-hover transition-colors" aria-label="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
        title="Delete work order"
        message={
          <>Permanently remove <span className="font-medium text-foreground">{deleteTarget?.title}</span>? This cannot be undone.</>
        }
      />

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingOrder ? 'Edit Work Order' : 'New Work Order'}
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
            {(editingOrder ? canEdit : canCreate) && (
              <Button variant="primary" onClick={() => form.handleSubmit()} loading={isMutating}>
                {editingOrder ? 'Save Changes' : 'Create'}
              </Button>
            )}
          </>
        }
      >
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <Input label="Title" {...form.getFieldProps('title')} error={getFieldError('title', form.errors, form.touched)} required />
          <Textarea label="Description" {...form.getFieldProps('description')} error={getFieldError('description', form.errors, form.touched)} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" {...form.getFieldProps('type')} error={getFieldError('type', form.errors, form.touched)} options={TYPE_OPTIONS} />
            <Select label="Priority" {...form.getFieldProps('priority')} error={getFieldError('priority', form.errors, form.touched)} options={PRIORITY_OPTIONS} />
          </div>
          <Input label="Assigned To" {...form.getFieldProps('assignedTo')} error={getFieldError('assignedTo', form.errors, form.touched)} placeholder="Staff name" />
          <Input label="Due Date" type="date" {...form.getFieldProps('dueDate')} error={getFieldError('dueDate', form.errors, form.touched)} />
        </form>
      </Modal>
    </div>
  );
}
