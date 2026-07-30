import { useState, useMemo } from 'react';
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
  Card, CardBody, Button, Modal, Input, Select, Textarea,
  Badge, EmptyState, LoadingSpinner, PageError, StatCard, TABLE_HEAD_CLASS } from '../components/ui';
import { Plus, Search, Edit, Trash2, ClipboardList, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { isThisMonth } from 'date-fns';

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

  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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


  const handleEdit = (wo: WorkOrder) => {
    setEditingOrder(wo);
    form.setValues({
      title: wo.title,
      description: wo.description || '',
      type: wo.type,
      priority: wo.priority,
      assignedTo: wo.assignedTo || '',
      dueDate: wo.dueDate ? format(new Date(wo.dueDate), 'yyyy-MM-dd') : '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this work order? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Work Orders</h1>
          <p className="text-foreground-muted mt-1">Manage and track maintenance and service tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { form.reset(initialForm); setEditingOrder(null); setShowModal(true); }}>
            New Work Order
          </Button>
        </div>
      </div>

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
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <Card><CardBody><LoadingSpinner className="py-8" /></CardBody></Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList size={48} />}
              title="No work orders found"
              description={searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first work order to get started'}
              action={
                <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>
                  New Work Order
                </Button>
              }
            />
          </CardBody>
        </Card>
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
                    <td className="px-6 py-4 text-sm text-foreground-muted">
                      {wo.dueDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          {format(new Date(wo.dueDate), 'MMM d, yyyy')}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(wo)} className="text-primary hover:text-primary-hover transition-colors" aria-label="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(wo.id)} className="text-danger hover:text-danger-hover transition-colors" aria-label="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingOrder(null); }}
        title={editingOrder ? 'Edit Work Order' : 'New Work Order'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => form.handleSubmit()} loading={isMutating}>
              {editingOrder ? 'Save Changes' : 'Create'}
            </Button>
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
