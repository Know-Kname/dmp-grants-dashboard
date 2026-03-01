import { useState, useMemo } from 'react';
import { useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useDeleteWorkOrder } from '../hooks/useData';
import { getErrorDetails, getErrorMessage, getErrorRequestId } from '../lib/errors';
import { formatStatus, formatDateForInput } from '../lib/utils';
import type { WorkOrder } from '../types';
import { Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState, LoadingSpinner } from '../components/ui';
import { Plus, Search, ClipboardList, Calendar, Edit, Trash2, AlertCircle, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

type WorkOrderFormData = {
  title: string;
  description: string;
  type: WorkOrder['type'];
  priority: WorkOrder['priority'];
  assignedTo: string;
  dueDate: string;
};

const initialFormData: WorkOrderFormData = {
  title: '',
  description: '',
  type: 'maintenance',
  priority: 'medium',
  assignedTo: '',
  dueDate: '',
};

export default function WorkOrders() {
  const { data: workOrdersData, isLoading, error, refetch } = useWorkOrders();
  const workOrders: WorkOrder[] = Array.isArray(workOrdersData) ? workOrdersData : (workOrdersData?.data ?? []);

  const createMutation = useCreateWorkOrder({
    onSuccess: () => {
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useUpdateWorkOrder({
    onSuccess: () => {
      setShowModal(false);
      setEditingOrder(null);
      resetForm();
    },
  });

  const deleteMutation = useDeleteWorkOrder();

  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    let filtered = workOrders;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.title.toLowerCase().includes(search) ||
        wo.description?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    return filtered;
  }, [workOrders, searchTerm, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: workOrders.length,
    pending: workOrders.filter(wo => wo.status === 'pending').length,
    inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
    completed: workOrders.filter(wo => wo.status === 'completed').length,
    urgent: workOrders.filter(wo => wo.priority === 'urgent' && wo.status !== 'completed').length,
  }), [workOrders]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      title: formData.title,
      description: formData.description || '',
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

  const [formData, setFormData] = useState<WorkOrderFormData>(initialFormData);

  const handleEdit = (order: WorkOrder) => {
    setEditingOrder(order);
    setFormData({
      title: order.title,
      description: order.description || '',
      type: order.type,
      priority: order.priority,
      assignedTo: order.assignedTo || '',
      dueDate: order.dueDate ? formatDateForInput(order.dueDate) : '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this work order?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const getStatusBadge = (status: WorkOrder['status']) => {
    const variants: Record<WorkOrder['status'], 'warning' | 'info' | 'success' | 'danger'> = {
      pending: 'warning',
      in_progress: 'info',
      completed: 'success',
      cancelled: 'danger',
    };
    return <Badge variant={variants[status]} dot>{formatStatus(status)}</Badge>;
  };

  const getPriorityBadge = (priority: WorkOrder['priority']) => {
    const variants: Record<WorkOrder['priority'], 'secondary' | 'info' | 'warning' | 'danger'> = {
      low: 'secondary',
      medium: 'info',
      high: 'warning',
      urgent: 'danger',
    };
    return <Badge variant={variants[priority]} size="sm">{priority}</Badge>;
  };

  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error;
  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const combinedError = error || mutationError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Work Orders</h1>
          <p className="text-foreground-muted mt-1">Manage and track all maintenance and service tasks</p>
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
              setEditingOrder(null);
              setShowModal(true);
            }}
          >
            New Work Order
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
            {(() => {
              const details = getErrorDetails(combinedError);
              const requestId = getErrorRequestId(combinedError);
              return (details.length > 0 || requestId) ? (
                <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 list-disc pl-5 space-y-1">
                  {details.map((detail, index) => (
                    <li key={`${detail}-${index}`}>{detail}</li>
                  ))}
                  {requestId && <li>Request ID: {requestId}</li>}
                </ul>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Total</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="p-3 bg-info-100 dark:bg-info-950 rounded-lg">
                <ClipboardList className="text-info" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Pending</p>
                <p className="text-2xl font-bold text-warning">{stats.pending}</p>
              </div>
              <div className="p-3 bg-warning-100 dark:bg-warning-950 rounded-lg">
                <Clock className="text-warning" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">In Progress</p>
                <p className="text-2xl font-bold text-info">{stats.inProgress}</p>
              </div>
              <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
                <RefreshCw className="text-primary" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted mb-1">Completed</p>
                <p className="text-2xl font-bold text-success">{stats.completed}</p>
              </div>
              <div className="p-3 bg-success-100 dark:bg-success-950 rounded-lg">
                <CheckCircle2 className="text-success" size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Urgent Alert */}
      {stats.urgent > 0 && (
        <Card className="border-l-4 border-l-danger">
          <CardBody className="flex items-center gap-3">
            <AlertCircle className="text-danger shrink-0" size={20} />
            <p className="text-sm text-foreground">
              <span className="font-semibold text-danger">{stats.urgent} urgent</span> work order{stats.urgent !== 1 ? 's' : ''} need{stats.urgent === 1 ? 's' : ''} attention
            </p>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search work orders..."
              icon={<Search size={18} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <Select
              options={[
                { value: 'all', label: 'All Priority' },
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            />
            <div className="flex items-center text-sm text-foreground-muted">
              {filteredOrders.length} of {workOrders.length} orders
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
              <p className="text-center text-foreground-muted mt-4">Loading work orders...</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && filteredOrders.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList size={48} />}
              title="No work orders found"
              description={searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? "Try adjusting your filters"
                : "Create your first work order to get started"}
              action={
                <Button variant="primary" icon={<Plus size={20} />} onClick={() => setShowModal(true)}>
                  Create Work Order
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {/* Desktop Table View */}
      {!isLoading && filteredOrders.length > 0 && (
        <>
          {/* Table for lg+ screens */}
          <Card className="hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-subtle border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      Work Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-background-subtle transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{wo.title}</div>
                        {wo.description && (
                          <div className="text-sm text-foreground-muted truncate max-w-xs">
                            {wo.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground capitalize">
                        {formatStatus(wo.type)}
                      </td>
                      <td className="px-6 py-4">
                        {getPriorityBadge(wo.priority)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(wo.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground-muted">
                        {wo.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{format(new Date(wo.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-foreground-subtle">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(wo)}
                            className="p-1.5 text-foreground-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors"
                            aria-label="Edit work order"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(wo.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-foreground-muted hover:text-danger hover:bg-danger-50 dark:hover:bg-danger-950 rounded-lg transition-colors disabled:opacity-50"
                            aria-label="Delete work order"
                          >
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

          {/* Card view for mobile/tablet */}
          <div className="grid gap-4 lg:hidden">
            {filteredOrders.map((wo) => (
              <Card key={wo.id} hoverable className="animate-fade-in">
                <CardBody>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-foreground">{wo.title}</h3>
                        {getPriorityBadge(wo.priority)}
                      </div>
                      {wo.description && (
                        <p className="text-foreground-muted mb-3 line-clamp-2 text-sm">{wo.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
                        <span className="capitalize">{formatStatus(wo.type)}</span>
                        {wo.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{format(new Date(wo.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {getStatusBadge(wo.status)}
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(wo)}
                          className="p-1.5 text-foreground-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(wo.id)}
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
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingOrder(null);
          resetForm();
        }}
        title={editingOrder ? 'Edit Work Order' : 'Create New Work Order'}
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
              {editingOrder ? 'Update' : 'Create'}
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
            placeholder="e.g., Repair headstone in Section B"
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the work to be done..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as WorkOrder['type'] })}
              options={[
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'burial_prep', label: 'Burial Prep' },
                { value: 'grounds', label: 'Grounds' },
                { value: 'repair', label: 'Repair' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as WorkOrder['priority'] })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Assigned To"
              value={formData.assignedTo}
              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              placeholder="Staff member name"
            />
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
