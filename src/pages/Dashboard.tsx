import { useMemo, lazy, Suspense } from 'react';
const LocationsMap = lazy(() => import('../components/LocationsMap'));
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subMonths, startOfMonth, parseISO } from 'date-fns';
import {
  ClipboardList, Package, DollarSign, Users, AlertCircle,
  TrendingUp, BookOpen, FileText, Activity, Zap,
} from 'lucide-react';
import {
  useWorkOrders, useBurials, useInventory, useReceivables,
  useDeposits, useContracts,
} from '../hooks/useData';
import { Card, CardHeader, CardBody, Badge } from '../components/ui';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';
import { formatCurrency } from '../lib/utils';

const C = {
  green: BRAND.green,
  gold: BRAND.gold,
  info: '#0ea5e9',
  success: '#22c55e',
  warning: '#f59e0b',
  muted: '#94a3b8',
  tick: '#94a3b8',
  grid: '#e2e8f0',
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  formatter?: (v: number) => string;
}

function ChartTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm min-w-[110px]">
      {label && <p className="text-foreground-muted text-xs mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: workOrders = [] } = useWorkOrders();
  const { data: burials = [] } = useBurials();
  const { data: inventory = [] } = useInventory();
  const { data: receivables = [] } = useReceivables();
  const { data: deposits = [] } = useDeposits();
  const { data: contracts = [] } = useContracts();

  const now = new Date();

  // Last 12 month buckets
  const months = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i);
      return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM') };
    }),
  []);

  // ── KPI stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const thisMonthKey = format(startOfMonth(now), 'yyyy-MM');
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thisYear = now.getFullYear();

    const burialsThisMonth = burials.filter(b => b.burialDate.startsWith(thisMonthKey)).length;
    const burialsYTD = burials.filter(b => parseISO(b.burialDate).getFullYear() === thisYear).length;

    const activeContracts = contracts.filter(c => c.status === 'active');
    const contractsValue = activeContracts.reduce((s, c) => s + c.totalAmount, 0);

    const unpaidAR = receivables.filter(r => r.status !== 'paid');
    const arOutstanding = unpaidAR.reduce((s, r) => s + (r.amount - r.amountPaid), 0);
    const overdueAR = receivables.filter(r => r.status === 'overdue').length;

    const lowStock = inventory.filter(i => i.quantity <= i.reorderPoint).length;

    const revenue30d = deposits
      .filter(d => parseISO(d.date) >= thirtyDaysAgo)
      .reduce((s, d) => s + d.amount, 0);

    return {
      burialsThisMonth, burialsYTD,
      activeContracts: activeContracts.length, contractsValue,
      arOutstanding, overdueAR,
      unpaidAR: unpaidAR.length,
      activeWO: workOrders.filter(w => w.status === 'in_progress').length,
      totalWO: workOrders.length,
      lowStock, totalInventory: inventory.length,
      revenue30d,
    };
  }, [workOrders, burials, inventory, receivables, deposits, contracts]);

  // ── Chart data ─────────────────────────────────────────────
  const burialTrend = useMemo(() =>
    months.map(m => ({
      month: m.label,
      Burials: burials.filter(b => b.burialDate.startsWith(m.key)).length,
    })),
  [burials, months]);

  const revenueTrend = useMemo(() =>
    months.map(m => ({
      month: m.label,
      Revenue: deposits
        .filter(d => d.date.startsWith(m.key))
        .reduce((s, d) => s + d.amount, 0),
    })),
  [deposits, months]);

  const woChartData = useMemo(() => {
    const raw = [
      { name: 'Pending',     value: workOrders.filter(w => w.status === 'pending').length,     color: C.warning },
      { name: 'In Progress', value: workOrders.filter(w => w.status === 'in_progress').length, color: C.info },
      { name: 'Completed',   value: workOrders.filter(w => w.status === 'completed').length,   color: C.success },
      { name: 'Cancelled',   value: workOrders.filter(w => w.status === 'cancelled').length,   color: C.muted },
    ].filter(d => d.value > 0);
    return raw.length > 0 ? raw : [{ name: 'No Data', value: 1, color: '#e2e8f0' }];
  }, [workOrders]);

  const inventoryCategoryData = useMemo(() => {
    const cats = ['casket', 'urn', 'vault', 'marker', 'supplies', 'other'] as const;
    return cats.map(cat => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      Items: inventory.filter(i => i.category === cat).length,
    })).filter(d => d.Items > 0);
  }, [inventory]);

  // ── Recent activity ────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const wos = workOrders.slice(0, 5).map(w => ({
      type: 'work_order' as const,
      title: w.title,
      sub: w.status.replace('_', ' '),
      date: w.createdAt,
      status: w.status,
    }));
    const bs = burials.slice(0, 3).map(b => ({
      type: 'burial' as const,
      title: `${b.deceasedLastName}, ${b.deceasedFirstName}`,
      sub: b.plotLocation,
      date: b.burialDate,
      status: undefined as string | undefined,
    }));
    return [...wos, ...bs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [workOrders, burials]);

  const hasAlerts = stats.lowStock > 0 || stats.overdueAR > 0;

  const quickActions = [
    { to: '/burials',     icon: BookOpen,      label: 'Record Burial',    cls: 'text-primary bg-primary-100 dark:bg-primary-950' },
    { to: '/work-orders', icon: ClipboardList, label: 'New Work Order',   cls: 'text-info bg-info-100 dark:bg-info-950' },
    { to: '/financial',   icon: DollarSign,    label: 'Add Deposit',      cls: 'text-success bg-success-100 dark:bg-success-950' },
    { to: '/contracts',   icon: FileText,      label: 'New Contract',     cls: 'text-warning bg-warning-100 dark:bg-warning-950' },
    { to: '/customers',   icon: Users,         label: 'Add Customer',     cls: 'text-primary bg-primary-100 dark:bg-primary-950' },
    { to: '/inventory',   icon: Package,       label: 'Update Inventory', cls: 'text-info bg-info-100 dark:bg-info-950' },
  ] as const;

  return (
    <div className="space-y-6">

      {/* ── Brand Hero ── */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${BRAND.greenDeep} 0%, ${BRAND.green} 50%, #2d5a3d 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'url(/dmp-hero.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <img
                src="/dmp-logo.png"
                alt="Detroit Memorial Park"
                className="h-14 w-auto flex-shrink-0"
                style={{ filter: 'brightness(0) saturate(100%) invert(1)', opacity: 0.95 }}
              />
              <p className="text-white/55 text-sm">
                {COMPANY.tagline} · 3 Locations · 170+ Acres
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 lg:gap-8">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Today</p>
                <p className="text-white font-semibold mt-0.5">{format(now, 'EEEE, MMM d')}</p>
                <p className="text-white/50 text-sm">{format(now, 'yyyy')}</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Milestone</p>
                <p className="font-bold text-lg mt-0.5" style={{ color: C.gold }}>{now.getFullYear() - COMPANY.established}+ Years</p>
                <p className="text-white/50 text-xs">Since {COMPANY.established}</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Burials YTD</p>
                <p className="text-white font-bold text-2xl mt-0.5">{stats.burialsYTD}</p>
                <p className="text-white/50 text-xs">{stats.burialsThisMonth} this month</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Active WO</p>
                <p className="text-white font-bold text-2xl mt-0.5">{stats.activeWO}</p>
                <p className="text-white/50 text-xs">{stats.totalWO} total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alert Bar ── */}
      {hasAlerts && (
        <div className="flex items-start gap-3 bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 rounded-xl px-4 py-3">
          <AlertCircle className="text-warning shrink-0 mt-0.5" size={18} />
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {stats.lowStock > 0 && (
              <Link to="/inventory" className="text-warning-700 dark:text-warning-400 hover:underline">
                {stats.lowStock} inventory item{stats.lowStock !== 1 ? 's' : ''} below reorder point
              </Link>
            )}
            {stats.overdueAR > 0 && (
              <Link to="/financial" className="text-warning-700 dark:text-warning-400 hover:underline">
                {stats.overdueAR} overdue receivable{stats.overdueAR !== 1 ? 's' : ''}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Link to="/burials" className="contents">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Burials</p>
                <div className="p-1.5 bg-primary-100 dark:bg-primary-950 rounded-lg">
                  <BookOpen size={14} className="text-primary" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.burialsThisMonth}</p>
                <p className="text-xs text-foreground-muted mt-0.5">this month</p>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link to="/contracts" className="contents">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Contracts</p>
                <div className="p-1.5 bg-info-100 dark:bg-info-950 rounded-lg">
                  <FileText size={14} className="text-info" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.activeContracts}</p>
                <p className="text-xs text-foreground-muted mt-0.5">{formatCurrency(stats.contractsValue)}</p>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link to="/financial" className="contents">
          <Card hoverable className={`h-full ${stats.overdueAR > 0 ? 'border-warning' : ''}`}>
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Receivables</p>
                <div className={`p-1.5 rounded-lg ${stats.overdueAR > 0 ? 'bg-warning-100 dark:bg-warning-950' : 'bg-success-100 dark:bg-success-950'}`}>
                  <DollarSign size={14} className={stats.overdueAR > 0 ? 'text-warning' : 'text-success'} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.arOutstanding)}</p>
                <p className="text-xs text-foreground-muted mt-0.5">{stats.unpaidAR} open</p>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link to="/work-orders" className="contents">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Work Orders</p>
                <div className="p-1.5 bg-info-100 dark:bg-info-950 rounded-lg">
                  <ClipboardList size={14} className="text-info" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.totalWO}</p>
                <p className="text-xs text-foreground-muted mt-0.5">{stats.activeWO} in progress</p>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link to="/inventory" className="contents">
          <Card hoverable className={`h-full ${stats.lowStock > 0 ? 'border-warning' : ''}`}>
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Inventory</p>
                <div className={`p-1.5 rounded-lg ${stats.lowStock > 0 ? 'bg-warning-100 dark:bg-warning-950' : 'bg-success-100 dark:bg-success-950'}`}>
                  <Package size={14} className={stats.lowStock > 0 ? 'text-warning' : 'text-success'} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.totalInventory}</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {stats.lowStock > 0 ? `${stats.lowStock} low stock` : 'All stocked'}
                </p>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link to="/financial" className="contents">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Revenue (30d)</p>
                <div className="p-1.5 bg-success-100 dark:bg-success-950 rounded-lg">
                  <TrendingUp size={14} className="text-success" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.revenue30d)}</p>
                <p className="text-xs text-foreground-muted mt-0.5">deposits</p>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>

      {/* ── Charts Row 1: Burial Trend + Work Orders Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Burial Trend</h3>
              <p className="text-xs text-foreground-muted mt-0.5">Interments per month — last 12 months</p>
            </div>
            <Badge variant="secondary" size="sm">{stats.burialsYTD} YTD</Badge>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={burialTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="burialGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.green} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.6} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.tick }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.tick }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Burials"
                  stroke={C.green}
                  strokeWidth={2.5}
                  fill="url(#burialGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: C.green, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Work Order Status</h3>
            <p className="text-xs text-foreground-muted mt-0.5">{stats.totalWO} total orders</p>
          </CardHeader>
          <CardBody className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={woChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {woChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-1">
              {woChartData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Charts Row 2: Revenue + Inventory by Category ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Monthly Revenue</h3>
              <p className="text-xs text-foreground-muted mt-0.5">Deposit totals — last 12 months</p>
            </div>
            <Badge variant="success" size="sm">{formatCurrency(stats.revenue30d)} (30d)</Badge>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={revenueTrend} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.gold} stopOpacity={1} />
                    <stop offset="100%" stopColor={C.gold} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.tick }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: C.tick }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                />
                <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="Revenue" fill="url(#revenueGrad)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Inventory by Category</h3>
              <p className="text-xs text-foreground-muted mt-0.5">{stats.totalInventory} items on hand</p>
            </div>
          </CardHeader>
          <CardBody>
            {inventoryCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={inventoryCategoryData} layout="vertical" margin={{ top: 0, right: 8, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.6} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: C.tick }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: C.tick }} axisLine={false} tickLine={false} width={58} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Items" fill={C.green} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[210px] flex items-center justify-center text-foreground-muted text-sm">
                No inventory data yet
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Locations Map ── */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">DMP Locations</h3>
            <p className="text-xs text-foreground-muted mt-0.5">3 properties across Michigan · click a marker for details</p>
          </div>
          <Badge variant="secondary" size="sm">3 Sites · 170+ Acres</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center bg-background-subtle rounded-b-xl" style={{ height: 420 }}>
                <div className="flex flex-col items-center gap-3 text-foreground-muted">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm">Loading map…</p>
                </div>
              </div>
            }
          >
            <LocationsMap height={420} />
          </Suspense>
        </CardBody>
      </Card>

      {/* ── Bottom Row: Activity | Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
            <Activity size={15} className="text-foreground-muted" />
          </CardHeader>
          <CardBody>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-foreground-muted text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                      a.type === 'burial'
                        ? 'bg-primary-100 dark:bg-primary-950'
                        : 'bg-info-100 dark:bg-info-950'
                    }`}>
                      {a.type === 'burial'
                        ? <BookOpen size={12} className="text-primary" />
                        : <ClipboardList size={12} className="text-info" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-foreground-muted mt-0.5 capitalize">
                        {a.sub} · {format(new Date(a.date), 'MMM d')}
                      </p>
                    </div>
                    {a.status && (
                      <Badge
                        variant={
                          a.status === 'completed'   ? 'success' :
                          a.status === 'in_progress' ? 'info'    : 'warning'
                        }
                        size="sm"
                      >
                        {a.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Quick Actions</h3>
            <Zap size={15} className="text-foreground-muted" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(({ to, icon: Icon, label, cls }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors group text-center"
                >
                  <div className={`p-2 rounded-lg ${cls}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-medium text-foreground-muted group-hover:text-foreground leading-tight">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

      </div>
    </div>
  );
}
