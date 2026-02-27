import { useEffect, useState } from 'react';
import { demoGrants } from '../lib/demo-data';
import { Card, CardBody, Button, Modal, Input, Select, Textarea, Badge, EmptyState } from '../components/ui';
import { Plus, Search, DollarSign, Calendar, ExternalLink, Gift, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../components/Toast';

export default function Grants() {
  const [grants, setGrants] = useState<any[]>([]);
  const [filteredGrants, setFilteredGrants] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { success } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'grant',
    source: '',
    amount: '',
    deadline: '',
    status: 'available',
    applicationDate: '',
    notes: '',
  });

  useEffect(() => {
    // Load demo data on mount
    setGrants(demoGrants);
  }, []);

  useEffect(() => {
    filterGrants();
  }, [grants, searchTerm, statusFilter, typeFilter]);

  const filterGrants = () => {
    let filtered = grants;

    if (searchTerm) {
      filtered = filtered.filter(g =>
        g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.source?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(g => g.type === typeFilter);
    }

    setFilteredGrants(filtered);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      amount: formData.amount ? parseFloat(formData.amount) : null,
      deadline: formData.deadline || null,
      application_date: formData.applicationDate || null,
    };

    if (editingGrant) {
      setGrants(prev => prev.map(g =>
        g.id === editingGrant.id ? { ...g, ...payload } : g
      ));
      success('Grant updated', 'Changes saved successfully');
    } else {
      const newGrant = {
        id: Date.now().toString(),
        ...payload,
        created_at: new Date().toISOString(),
      };
      setGrants(prev => [newGrant, ...prev]);
      success('Grant added', 'New grant added successfully');
    }

    setShowModal(false);
    setEditingGrant(null);
    resetForm();
  };

  const handleEdit = (grant: any) => {
    setEditingGrant(grant);
    setFormData({
      title: grant.title,
      description: grant.description || '',
      type: grant.type,
      source: grant.source,
      amount: grant.amount?.toString() || '',
      deadline: grant.deadline ? format(new Date(grant.deadline), 'yyyy-MM-dd') : '',
      status: grant.status,
      applicationDate: grant.application_date ? format(new Date(grant.application_date), 'yyyy-MM-dd') : '',
      notes: grant.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this grant/opportunity?')) {
      setGrants(prev => prev.filter(g => g.id !== id));
      success('Grant deleted', 'Grant removed successfully');
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setGrants(prev => prev.map(g =>
      g.id === id ? { ...g, status: newStatus } : g
    ));
    success('Status updated', `Grant marked as ${newStatus}`);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'grant',
      source: '',
      amount: '',
      deadline: '',
      status: 'available',
      applicationDate: '',
      notes: '',
    });
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      grant: 'primary',
      benefit: 'success',
      opportunity: 'info',
    };
    return <Badge variant={variants[type]} size="sm">{type}</Badge>;
  };

  // Calculate total amounts
  const totalAvailable = filteredGrants
    .filter(g => g.amount && g.status === 'available')
    .reduce((sum, g) => sum + parseFloat(g.amount), 0);
  const totalApplied = filteredGrants
    .filter(g => g.amount && g.status === 'applied')
    .reduce((sum, g) => sum + parseFloat(g.amount), 0);
  const totalReceived = filteredGrants
    .filter(g => g.amount && (g.status === 'received' || g.status === 'approved'))
    .reduce((sum, g) => sum + parseFloat(g.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grants & Opportunities</h1>
          <p className="text-gray-500 mt-1">Track funding opportunities and veteran benefits</p>
        </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Available Funding</p>
                <p className="text-2xl font-bold text-blue-600">${totalAvailable.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Gift className="text-blue-600" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Applied For</p>
                <p className="text-2xl font-bold text-yellow-600">${totalApplied.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="text-yellow-600" size={24} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Received</p>
                <p className="text-2xl font-bold text-green-600">${totalReceived.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="text-green-600" size={24} />
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
            <div className="flex items-center text-sm text-gray-600">
              {filteredGrants.length} of {grants.length} grants
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Grants List */}
      {filteredGrants.length === 0 ? (
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
      ) : (
        <div className="grid gap-6">
          {filteredGrants.map((grant) => (
            <Card key={grant.id} hoverable>
              <CardBody>
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{grant.title}</h3>
                      {getTypeBadge(grant.type)}
                    </div>
                    {grant.description && (
                      <p className="text-gray-600 mb-3">{grant.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <ExternalLink size={14} />
                        <span className="font-medium">{grant.source}</span>
                      </div>
                      {grant.amount && (
                        <div className="flex items-center space-x-1">
                          <DollarSign size={14} />
                          <span className="font-semibold text-gray-900">
                            ${parseFloat(grant.amount).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {grant.deadline && (
                        <div className="flex items-center space-x-1">
                          <Calendar size={14} />
                          <span>Deadline: {format(new Date(grant.deadline), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {grant.application_date && (
                        <div className="text-xs">
                          Applied: {format(new Date(grant.application_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                    {grant.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">{grant.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start space-x-3">
                    <select
                      value={grant.status}
                      onChange={(e) => handleStatusChange(grant.id, e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1 cursor-pointer focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="available">Available</option>
                      <option value="applied">Applied</option>
                      <option value="approved">Approved</option>
                      <option value="denied">Denied</option>
                      <option value="received">Received</option>
                    </select>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(grant)}
                        className="text-primary-600 hover:text-primary-800 p-1"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(grant.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete"
                      >
                        <Trash2 size={18} />
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
        }}
        title={editingGrant ? 'Edit Grant/Opportunity' : 'Add New Grant/Opportunity'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
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
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'grant', label: 'Grant' },
                { value: 'benefit', label: 'Benefit' },
                { value: 'opportunity', label: 'Opportunity' },
              ]}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
