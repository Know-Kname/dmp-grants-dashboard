import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState, Alert } from '../components/ui';
import { Plus, Search, Edit, Trash2, ClipboardList, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { getErrorDetails, getErrorMessage, getErrorRequestId } from '../lib/errors';

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'maintenance',
    priority: 'medium',
    assignedTo: '',
    dueDate: '',
  });

  useEffect(() => {
    loadWorkOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [workOrders, searchTerm, statusFilter]);

  const handleError = (err: unknown, fallback: string) => {
    const message = getErrorMessage(err, fallback);
    const details = getErrorDetails(err);
    const requestId = getErrorRequestId(err);
    setError(message);
    setErrorDetails(requestId ? [...details, `Request ID: ${requestId}`] : details);
  };

  const clearError = () => {
    setError(null);
    setErrorDetails([]);
  };

  const loadWorkOrders = async () => {
    try {
      const data = await api.get<any[]>('/work-orders');
      setWorkOrders(data);
      clearError();
    } catch (err) {
      handleError(err, 'Failed to load work orders.');
    }
  };

  const filterOrders = () => {
    let filtered = workOrders;

    if (searchTerm) {
      filtered = filtered.filter(wo =>
        wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOrder) {
        await api.put(`/work-orders/${editingOrder.id}`, formData);
      } else {
        await api.post('/work-orders', formData);
      }
      clearError();
      setShowModal(false);
      setEditingOrder(null);
      resetForm();
      loadWorkOrders();
    } catch (error) {
      handleError(error, 'Failed to save work order.');
    }
  };

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setFormData({
      title: order.title,
      description: order.description || '',
      type: order.type,
      priority: order.priority,
      assignedTo: order.assigned_to || '',
      dueDate: order.due_date ? format(new Date(order.due_date), 'yyyy-MM-dd') : '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this work order?')) {
      try {
        await api.delete(`/work-orders/${id}`);
        clearError();
        loadWorkOrders();
      } catch (error) {
        handleError(error, 'Failed to delete work order.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'maintenance',
      priority: 'medium',
      assignedTo: '',
      dueDate: '',
    });
  };

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'warning',
      in_progress: 'info',
      completed: 'success',
      cancelled: 'danger',
    };
    return <Badge variant={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      low: 'gray',
      medium: 'info',
      high: 'warning',
      urgent: 'danger',
    };
    return <Badge variant={variants[priority]} size="sm">{priority}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 mt-1">Manage and track all maintenance and service tasks</p>
        </div>
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

      {error && (
        <Alert
          title="Something went wrong"
          message={error}
          details={errorDetails}
          onDismiss={clearError}
        />
      )}

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search work orders..."
              icon={<Search size={18} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {filteredOrders.length} of {workOrders.length} orders
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Work Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList size={48} />}
              title="No work orders found"
              description={searchTerm || statusFilter !== 'all'
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
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{wo.title}</div>
                      {wo.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {wo.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm capitalize">
                      {wo.type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4">
                      {getPriorityBadge(wo.priority)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(wo.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {wo.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {wo.due_date ? (
                        <div className="flex items-center space-x-1">
                          <Calendar size={14} />
                          <span>{format(new Date(wo.due_date), 'MMM d, yyyy')}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(wo)}
                        className="text-primary-600 hover:text-primary-800"
                        aria-label="Edit work order"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(wo.id)}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Delete work order"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingOrder(null);
        }}
        title={editingOrder ? 'Edit Work Order' : 'Create New Work Order'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
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
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </div>
          <Input
            label="Due Date"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
