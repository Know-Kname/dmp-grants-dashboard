import { useState, useMemo } from 'react';
import {
  useWorkOrders, useCreateWorkOrder,
  useUpdateWorkOrder, useDeleteWorkOrder,
} from '../hooks/useData';
import type { WorkOrder } from '../types';
import {
  Card, CardBody, Button, Modal, Input, Select, Textarea,
  Badge, EmptyState, LoadingSpinner, PageError, StatCard } from '../components/ui';
import { Plus, Search, Edit, Trash2, ClipboardList, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { isThisMonth } from 'date-fns';

type WorkOrderFormData = {
  title: string;
  description: string;
  type: WorkOrder['type'];
  priority: WorkOrder['priority'];
  assignedTo: string;
  dueDate: string;
};

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

  const createMutation = useCreateWorkOrder({ onSuccess: () => { setShowModal(false); setFormData(initialForm); } });
  const updateMutation = useUpdateWorkOrder({ onSuccess: () => { setShowModal(false); setEditingOrder(null); setFormData(initialForm); } });
  const deleteMutation = useDeleteWorkOrder();

  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState<WorkOrderFormData>(initialForm);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: formData.title,
      description: formData.description,
      type: formData.type,
      priority: formData.priority,
      assignedTo: formData.assignedTo || undefined,
      dueDate: formData.dueDate || undefined,
    };
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, ...payload });
    } else {
      createMutation.mutate(payload as Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>);
    }
  };

  const handleEdit = (wo: WorkOrder) => {
    setEditingOrder(wo);
    setFormData({
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
  const f = (field: keyof WorkOrderFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

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
          <Button variant="primary" icon={<Plus size={20} />} onClick={() => { setFormData(initialForm); setEditingOrder(null); setShowModal(true); }}>
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
                  {['Work Order', 'Type', 'Priority', 'Status', 'Assigned To', 'Due Date', ''].map(h => (
                    <th key={h} className={`px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider ${!h ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
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
                        <button onClick={() => handleDelete(wo.id)} className="text-destructive hover:text-destructive-hover transition-colors" aria-label="Delete">
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
            <Button variant="primary" onClick={handleSubmit} loading={isMutating}>
              {editingOrder ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={formData.title} onChange={f('title')} required />
          <Textarea label="Description" value={formData.description} onChange={f('description')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={formData.type} onChange={f('type')} options={TYPE_OPTIONS} />
            <Select label="Priority" value={formData.priority} onChange={f('priority')} options={PRIORITY_OPTIONS} />
          </div>
          <Input label="Assigned To" value={formData.assignedTo} onChange={f('assignedTo')} placeholder="Staff name" />
          <Input label="Due Date" type="date" value={formData.dueDate} onChange={f('dueDate')} />
        </form>
      </Modal>
    </div>
  );
}
