import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, CardHeader, CardBody, LoadingSpinner, Badge } from '../components/ui';
import {
  ClipboardList, Package, DollarSign, Users, AlertCircle,
  MapPin, Phone, Building2,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { COMPANY } from '../config/company';
import { formatCurrency } from '../lib/utils';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    workOrders: { total: 0, pending: 0, inProgress: 0, completed: 0 },
    inventory: { total: 0, lowStock: 0 },
    receivables: { total: 0, overdue: 0, amount: 0 },
    burials: { total: 0, thisMonth: 0 },
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [workOrders, inventory, receivables, burials] = await Promise.all([
        api.get('/work-orders'),
        api.get('/inventory'),
        api.get('/financial/receivables'),
        api.get('/burials'),
      ]);

      // Calculate work order stats
      const woStats = {
        total: (workOrders as any[]).length,
        pending: (workOrders as any[]).filter((w: any) => w.status === 'pending').length,
        inProgress: (workOrders as any[]).filter((w: any) => w.status === 'in_progress').length,
        completed: (workOrders as any[]).filter((w: any) => w.status === 'completed').length,
      };

      // Calculate inventory stats
      const invStats = {
        total: (inventory as any[]).length,
        lowStock: (inventory as any[]).filter((i: any) => i.quantity <= i.reorder_point).length,
      };

      // Calculate receivables stats
      const arStats = {
        total: (receivables as any[]).length,
        overdue: (receivables as any[]).filter((r: any) => r.status === 'overdue').length,
        amount: (receivables as any[]).reduce((sum: number, r: any) => sum + (r.amount - (r.amount_paid || 0)), 0),
      };

      // Calculate burial stats
      const now = new Date();
      const thisMonth = (burials as any[]).filter((b: any) => {
        const burialDate = new Date(b.burial_date);
        return burialDate.getMonth() === now.getMonth() && burialDate.getFullYear() === now.getFullYear();
      }).length;

      setStats({
        workOrders: woStats,
        inventory: invStats,
        receivables: arStats,
        burials: { total: (burials as any[]).length, thisMonth },
      });

      // Create recent activity feed
      const activities = [
        ...(workOrders as any[]).slice(0, 3).map((w: any) => ({
          type: 'work_order',
          title: w.title,
          status: w.status,
          date: w.created_at,
        })),
        ...(burials as any[]).slice(0, 2).map((b: any) => ({
          type: 'burial',
          title: `${b.deceased_first_name} ${b.deceased_last_name}`,
          date: b.burial_date,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      setRecentActivity(activities);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      icon: ClipboardList,
      label: 'Work Orders',
      value: stats.workOrders.total,
      subtitle: `${stats.workOrders.inProgress} in progress`,
      color: 'bg-info',
      link: '/work-orders',
    },
    {
      icon: Package,
      label: 'Inventory Items',
      value: stats.inventory.total,
      subtitle: stats.inventory.lowStock > 0 ? `${stats.inventory.lowStock} low stock` : 'All items stocked',
      color: stats.inventory.lowStock > 0 ? 'bg-warning' : 'bg-success',
      alert: stats.inventory.lowStock > 0,
      link: '/inventory',
    },
    {
      icon: DollarSign,
      label: 'Receivables',
      value: formatCurrency(stats.receivables.amount),
      subtitle: `${stats.receivables.total} accounts`,
      color: 'bg-warning',
      alert: stats.receivables.overdue > 0,
      link: '/financial',
    },
    {
      icon: Users,
      label: 'Burials (YTD)',
      value: stats.burials.total,
      subtitle: `${stats.burials.thisMonth} this month`,
      color: 'bg-primary',
      link: '/burials',
    },
  ];

  const locations = Object.entries(COMPANY.locations);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-foreground-muted mt-1">
            Welcome back! Here's what's happening at {COMPANY.shortName}.
          </p>
        </div>
        <div className="text-sm text-foreground-muted">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>
      </div>

      {/* Company Overview Card */}
      <Card className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-slate-900 border-primary-200 dark:border-primary-800">
        <CardBody className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                  <Building2 className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{COMPANY.name}</h2>
                  <p className="text-sm text-foreground-muted">{COMPANY.tagline}</p>
                </div>
              </div>
              <p className="text-sm text-foreground-muted max-w-2xl">
                {COMPANY.description}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={`tel:${COMPANY.phone.main.replace(/[^\d]/g, '')}`}
                className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Phone size={16} className="text-primary" />
                <span className="text-sm font-medium">{COMPANY.phone.main}</span>
              </a>
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <ExternalLink size={16} className="text-primary" />
                <span className="text-sm font-medium">Website</span>
              </a>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Alerts */}
      {(stats.inventory.lowStock > 0 || stats.receivables.overdue > 0) && (
        <Card className="border-l-4 border-l-warning">
          <CardBody className="flex items-start space-x-3">
            <AlertCircle className="text-warning mt-0.5 shrink-0" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Attention Required</h3>
              <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
                {stats.inventory.lowStock > 0 && (
                  <li>• {stats.inventory.lowStock} inventory items are low on stock</li>
                )}
                {stats.receivables.overdue > 0 && (
                  <li>• {stats.receivables.overdue} accounts receivable are overdue</li>
                )}
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} to={card.link}>
            <Card hoverable className="relative overflow-hidden h-full">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-foreground-muted text-sm font-medium mb-1">{card.label}</p>
                    <p className="text-3xl font-bold text-foreground mb-1">{card.value}</p>
                    <p className="text-xs text-foreground-muted">{card.subtitle}</p>
                  </div>
                  <div className={`${card.color} p-4 rounded-xl`}>
                    <card.icon className="text-white" size={28} />
                  </div>
                </div>
                {card.alert && (
                  <div className="absolute top-3 right-3">
                    <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                  </div>
                )}
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Work Orders Status */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Work Orders Status</h3>
            <Link to="/work-orders" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-warning rounded-full" />
                <span className="text-sm text-foreground-muted">Pending</span>
              </div>
              <span className="font-semibold text-foreground">{stats.workOrders.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-info rounded-full" />
                <span className="text-sm text-foreground-muted">In Progress</span>
              </div>
              <span className="font-semibold text-foreground">{stats.workOrders.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-success rounded-full" />
                <span className="text-sm text-foreground-muted">Completed</span>
              </div>
              <span className="font-semibold text-foreground">{stats.workOrders.completed}</span>
            </div>
          </CardBody>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
          </CardHeader>
          <CardBody>
            {recentActivity.length === 0 ? (
              <p className="text-foreground-muted text-sm text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-start space-x-3 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className={`p-2 rounded-lg ${activity.type === 'work_order' ? 'bg-info-100 dark:bg-info-950' : 'bg-primary-100 dark:bg-primary-950'}`}>
                      {activity.type === 'work_order' ? (
                        <ClipboardList size={16} className="text-info" />
                      ) : (
                        <Users size={16} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        {format(new Date(activity.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {activity.status && (
                      <Badge
                        variant={
                          activity.status === 'completed' ? 'success' :
                            activity.status === 'in_progress' ? 'info' : 'warning'
                        }
                        size="sm"
                      >
                        {activity.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Cemetery Locations */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Cemetery Locations</h3>
          <Badge variant="secondary">{locations.length} Locations</Badge>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locations.map(([key, location]) => (
              <div
                key={key}
                className="p-4 rounded-lg bg-background-subtle border border-border hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-950 rounded-lg">
                    <MapPin size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">{location.name}</h4>
                    <p className="text-sm text-foreground-muted mt-1">{location.address}</p>
                    <p className="text-sm text-foreground-muted">{location.city}, {location.state} {location.zip}</p>
                    <a
                      href={`tel:${location.phone.replace(/[^\d]/g, '')}`}
                      className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
                    >
                      <Phone size={12} />
                      {location.phone}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-foreground">Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/work-orders"
              className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-950 transition group"
            >
              <ClipboardList className="text-foreground-muted group-hover:text-primary mb-2" size={24} />
              <span className="text-sm font-medium text-foreground-muted group-hover:text-primary text-center">New Work Order</span>
            </Link>
            <Link
              to="/burials"
              className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-950 transition group"
            >
              <Users className="text-foreground-muted group-hover:text-primary mb-2" size={24} />
              <span className="text-sm font-medium text-foreground-muted group-hover:text-primary text-center">Record Burial</span>
            </Link>
            <Link
              to="/financial"
              className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-950 transition group"
            >
              <DollarSign className="text-foreground-muted group-hover:text-primary mb-2" size={24} />
              <span className="text-sm font-medium text-foreground-muted group-hover:text-primary text-center">Add Deposit</span>
            </Link>
            <Link
              to="/inventory"
              className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-950 transition group"
            >
              <Package className="text-foreground-muted group-hover:text-primary mb-2" size={24} />
              <span className="text-sm font-medium text-foreground-muted group-hover:text-primary text-center">Update Inventory</span>
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* Business Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Business Hours</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Monday - Friday</span>
                <span className="font-medium text-foreground">{COMPANY.hours.weekday.open} - {COMPANY.hours.weekday.close}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Saturday</span>
                <span className="font-medium text-foreground">{COMPANY.hours.saturday.open} - {COMPANY.hours.saturday.close}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Sunday</span>
                <span className="font-medium text-foreground">{COMPANY.hours.sunday}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Services Offered</h3>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {COMPANY.services.map((service) => (
                <Badge key={service} variant="secondary" size="sm">
                  {service}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
