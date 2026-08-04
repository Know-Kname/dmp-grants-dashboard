import { useMemo, useState, lazy, Suspense } from 'react';
const LocationsMap = lazy(() => import('../components/LocationsMap'));
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import {
  ClipboardList, Package, DollarSign, Users, AlertCircle,
  TrendingUp, TrendingDown, BookOpen, FileText, Activity, Zap, Gift,
  Share2, Layers, Truck,
} from 'lucide-react';
import {
  useDashboardSummary, useBurialTrend, useRevenueTrend,
  useRecentWorkOrders, useRecentBurials,
} from '../hooks/useData';
import {
  burialTrendSeries, revenueTrendSeries, workOrderChartData,
  inventoryCategoryData as buildInventoryCategoryData,
  referralSeries, ageBandSeries, vendorSpendSeries, modulesLoaded,
  formatMonthYear, periodLabel,
} from '../lib/dashboard';
import type { DashboardSummary, NamedCount } from '../lib/schemas';
import {
  Card, CardHeader, CardBody, Badge, PageError, AnimatedNumber,
  Skeleton, SkeletonStatRow, SkeletonChart, Tabs,
} from '../components/ui';
import { m, staggerContainer, fadeInUp } from '../lib/motion';
import { useTheme } from '../lib/theme';
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
};

/** Grid/tick colors per resolved theme so dark mode stops rendering light-gray gridlines. */
const CHART_THEME = {
  light: { tick: '#94a3b8', grid: '#e2e8f0', empty: '#e2e8f0' },
  dark:  { tick: '#64748b', grid: '#334155', empty: '#334155' },
} as const;

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

/**
 * What the KPI cards read while the summary is loading or has failed.
 *
 * The page renders its own error and keeps its layout rather than blanking, so
 * the components below always need a summary-shaped object. Zeros are honest
 * here: the alert bar and the trend arrows are all driven by `> 0` checks.
 */
const EMPTY_SUMMARY: DashboardSummary = {
  generatedAt: '',
  dataAsOf: null,
  burialsLatestMonth: 0, burialsPriorMonth: 0, burialsTrailing12: 0,
  totalInterments: 0, intermentsByYear: {},
  topFuneralHomes: [], referralTop5Pct: null, distinctFuneralHomes: 0,
  topCounselors: [],
  ageBands: {}, medianAgeAtDeath: null,
  sectionsInUse: 0, topSections: [],
  capacity: {
    gravesTotal: 0, gravesOccupied: 0, lotsTotal: 0,
    runwayYears: null, runwayReason: null,
  },
  customerCount: 0,
  vendorCount: 0, vendorSpendKnown: 0, vendorSpendByCategory: {},
  topVendorsBySpend: [],
  burialsThisMonth: 0, burialsLastMonth: 0, burialsYTD: 0,
  totalContracts: 0, totalAR: 0, totalDeposits: 0,
  activeContracts: 0, contractsValue: 0,
  arOutstanding: 0, unpaidAR: 0, overdueAR: 0,
  apOutstanding: 0,
  activeWO: 0, totalWO: 0,
  lowStock: 0, totalInventory: 0,
  revenue30d: 0, revenuePrior30d: 0,
  workOrdersByStatus: {}, inventoryByCategory: {},
  upcomingGrants: [],
};

/**
 * A KPI card for a module whose source table has no rows yet.
 *
 * A bare `0` is indistinguishable from a broken query, and five of them at once
 * reads as a broken page. Naming the reason keeps the layout honest — and the
 * card returns to its normal self the moment the table has rows, with no code
 * change.
 */
function PendingCard({
  to, label, icon: Icon, note,
}: {
  to: string;
  label: string;
  icon: typeof BookOpen;
  note: string;
}) {
  return (
    <Link to={to} className="contents">
      <m.div variants={fadeInUp} className="h-full">
        <Card hoverable className="h-full border-dashed">
          <CardBody className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-foreground-subtle font-medium uppercase tracking-wide">{label}</p>
              <div className="p-1.5 bg-background-subtle rounded-lg">
                <Icon size={14} className="text-foreground-subtle" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground-subtle">Not loaded</p>
              <p className="text-xs text-foreground-subtle mt-0.5">{note}</p>
            </div>
          </CardBody>
        </Card>
      </m.div>
    </Link>
  );
}

/**
 * A compact ranked list with a proportional bar.
 *
 * Used where a chart would be overkill: six rows of `{name, n}` read faster as
 * a list than as another axis, and the bar carries the proportion without
 * spending a card's whole height on it. Bars are scaled to the largest row, so
 * the comparison stays within the list and never implies a share of some total
 * the list does not show.
 */
function RankedList({ rows, empty }: { rows: NamedCount[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-6">{empty}</p>;
  }
  const max = rows[0]?.n || 1;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3 text-sm">
          <span className="flex-1 truncate text-foreground-muted" title={r.name}>{r.name}</span>
          <div className="w-20 h-1.5 rounded-full bg-background-subtle overflow-hidden shrink-0">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.n / max) * 100}%`, backgroundColor: BRAND.green }}
            />
          </div>
          <span className="w-9 text-right font-medium text-foreground tabular-nums shrink-0">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

/** How many rows of each kind the activity feed asks the database for. */
const RECENT_WORK_ORDERS = 5;
const RECENT_BURIALS = 3;
const ACTIVITY_ROWS = 6;

export default function Dashboard() {
  const [monthsBack, setMonthsBack] = useState(12);

  // Every KPI on this page comes from one server-side aggregate. The trends are
  // separate queries because the 6M/12M/24M control changes only their range —
  // bundling them into the summary would refetch every KPI on each toggle.
  const summaryQ = useDashboardSummary();
  const burialTrendQ = useBurialTrend(monthsBack);
  const revenueTrendQ = useRevenueTrend(monthsBack);
  // The activity feed is the one thing the RPC does not cover. It reads the
  // newest few rows with a database-side LIMIT rather than downloading a table.
  const recentWorkOrdersQ = useRecentWorkOrders(RECENT_WORK_ORDERS);
  const recentBurialsQ = useRecentBurials(RECENT_BURIALS);

  const { resolvedTheme } = useTheme();
  const chart = CHART_THEME[resolvedTheme === 'dark' ? 'dark' : 'light'];

  const isLoading = summaryQ.isLoading || burialTrendQ.isLoading || revenueTrendQ.isLoading;
  // Any one query failing shows its message above a page that still renders:
  // the others' data is still good, and a blank dashboard tells staff nothing.
  const combinedError =
    summaryQ.error || burialTrendQ.error || revenueTrendQ.error ||
    recentWorkOrdersQ.error || recentBurialsQ.error;

  // Freeze "now" for the component's lifetime so the hero's date stays stable.
  const now = useMemo(() => new Date(), []);

  // ── KPI stats ──────────────────────────────────────────────
  const stats = summaryQ.data ?? EMPTY_SUMMARY;

  // Grant deadlines coming up within 30 days, already filtered, ranked and
  // capped at 3 by the RPC.
  const upcomingGrants = stats.upcomingGrants;

  // ── Chart data ─────────────────────────────────────────────
  const burialTrend = useMemo(
    () => burialTrendSeries(burialTrendQ.data ?? []),
    [burialTrendQ.data],
  );

  const revenueTrend = useMemo(
    () => revenueTrendSeries(revenueTrendQ.data ?? []),
    [revenueTrendQ.data],
  );

  const woChartData = useMemo(
    () => workOrderChartData(stats.workOrdersByStatus, {
      pending: C.warning,
      in_progress: C.info,
      completed: C.success,
      cancelled: C.muted,
      empty: C.muted,
    }),
    [stats.workOrdersByStatus],
  );

  const inventoryCategoryData = useMemo(
    () => buildInventoryCategoryData(stats.inventoryByCategory),
    [stats.inventoryByCategory],
  );

  const referralData = useMemo(
    () => referralSeries(stats.topFuneralHomes),
    [stats.topFuneralHomes],
  );

  const ageBandData = useMemo(() => ageBandSeries(stats.ageBands), [stats.ageBands]);

  const vendorSpendData = useMemo(
    () => vendorSpendSeries(stats.vendorSpendByCategory),
    [stats.vendorSpendByCategory],
  );

  // The period every anchored window is measured against. Stated on the cards
  // because a "trailing 12 months" figure that ends in 2020 is misleading
  // without it.
  const asOf = formatMonthYear(stats.dataAsOf);
  const hasInterments = stats.totalInterments > 0;
  // Population, not filtered figures — see modulesLoaded for why.
  const loaded = modulesLoaded(stats);

  /** The register's span, e.g. `2020` or `2018–2020`. */
  const yearSpan = useMemo(() => {
    const years = Object.keys(stats.intermentsByYear).sort();
    if (years.length === 0) return null;
    return years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`;
  }, [stats.intermentsByYear]);

  // ── Recent activity ────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const wos = (recentWorkOrdersQ.data ?? []).map(w => ({
      type: 'work_order' as const,
      title: w.title,
      sub: w.status.replace('_', ' '),
      date: w.createdAt,
      status: w.status,
    }));
    const bs = (recentBurialsQ.data ?? []).map(b => ({
      type: 'burial' as const,
      title: `${b.deceasedLastName}, ${b.deceasedFirstName}`,
      sub: b.plotLocation,
      date: b.burialDate,
      status: undefined as string | undefined,
    }));
    return [...wos, ...bs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, ACTIVITY_ROWS);
  }, [recentWorkOrdersQ.data, recentBurialsQ.data]);

  const hasAlerts = stats.lowStock > 0 || stats.overdueAR > 0;

  const quickActions = [
    { to: '/burials',     icon: BookOpen,      label: 'Record Burial',    cls: 'text-primary bg-primary-100 dark:bg-primary-950' },
    { to: '/work-orders', icon: ClipboardList, label: 'New Work Order',   cls: 'text-info bg-info-100 dark:bg-info-950' },
    { to: '/financial',   icon: DollarSign,    label: 'Add Deposit',      cls: 'text-success bg-success-100 dark:bg-success-950' },
    { to: '/contracts',   icon: FileText,      label: 'New Contract',     cls: 'text-warning bg-warning-100 dark:bg-warning-950' },
    { to: '/customers',   icon: Users,         label: 'Add Customer',     cls: 'text-primary bg-primary-100 dark:bg-primary-950' },
    { to: '/inventory',   icon: Package,       label: 'Update Inventory', cls: 'text-info bg-info-100 dark:bg-info-950' },
  ] as const;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <SkeletonStatRow count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2"><CardBody><SkeletonChart /></CardBody></Card>
          <Card><CardBody><SkeletonChart /></CardBody></Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardBody><SkeletonChart height={180} /></CardBody></Card>
          <Card><CardBody><SkeletonChart height={180} /></CardBody></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <PageError error={combinedError} />

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
                <p className="text-white/40 text-xs uppercase tracking-widest">Interments</p>
                <p className="text-white font-bold text-2xl mt-0.5">{stats.totalInterments}</p>
                <p className="text-white/50 text-xs">
                  {yearSpan ? `across ${yearSpan}` : 'none recorded'}
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Sections</p>
                <p className="text-white font-bold text-2xl mt-0.5">{stats.sectionsInUse}</p>
                <p className="text-white/50 text-xs">{stats.capacity.gravesTotal} graves mapped</p>
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

      {/* ── Grant deadlines ── */}
      {upcomingGrants.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 border"
          style={{ backgroundColor: 'rgba(196,154,44,0.07)', borderColor: 'rgba(196,154,44,0.35)' }}>
          <Gift size={18} className="shrink-0 mt-0.5" style={{ color: BRAND.gold }} />
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm items-center">
            <span className="font-medium text-foreground">Grant deadlines</span>
            {upcomingGrants.map(g => (
              <Link key={g.id} to={`/grants?q=${encodeURIComponent(g.title)}`} className="hover:underline inline-flex items-center gap-1.5 text-foreground-muted">
                <span className="truncate max-w-[220px]">{g.title}</span>
                <Badge variant={g.daysLeft <= 7 ? 'danger' : 'warning'} size="sm">
                  {g.daysLeft === 0 ? 'today' : `${g.daysLeft}d`}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards: what the register actually holds ── */}
      <m.div
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <Link to="/burials" className="contents">
          <m.div variants={fadeInUp} className="h-full">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Interments</p>
                <div className="p-1.5 bg-primary-100 dark:bg-primary-950 rounded-lg">
                  <BookOpen size={14} className="text-primary" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.totalInterments} /></p>
                {/*
                  Month over month against the anchor, not against the calendar.
                  The arrow is deliberately not coloured as good/bad: fewer
                  interments in a month is not a business failure, and flagging
                  it as one would be exactly the kind of unjustified direction
                  the cemetery scorecard rules warn about.
                */}
                <p className="text-xs text-foreground-muted mt-0.5 inline-flex items-center gap-1 flex-wrap">
                  {asOf ? `through ${asOf}` : 'none on record'}
                  {asOf && stats.burialsLatestMonth !== stats.burialsPriorMonth && (
                    stats.burialsLatestMonth > stats.burialsPriorMonth
                      ? <TrendingUp size={11} className="text-foreground-subtle" />
                      : <TrendingDown size={11} className="text-foreground-subtle" />
                  )}
                  {asOf && (
                    <span className="text-foreground-subtle">
                      {stats.burialsLatestMonth} vs {stats.burialsPriorMonth} prior mo
                    </span>
                  )}
                </p>
              </div>
            </CardBody>
          </Card>
        </m.div>
        </Link>

        {/* Concentration, not the leader's name: one home leaving is the risk. */}
        <Link to="/burials" className="contents">
          <m.div variants={fadeInUp} className="h-full">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Top 5 Referrers</p>
                <div className="p-1.5 bg-warning-100 dark:bg-warning-950 rounded-lg">
                  <Share2 size={14} className="text-warning" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {stats.referralTop5Pct !== null ? `${stats.referralTop5Pct}%` : '—'}
                </p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  of {stats.distinctFuneralHomes} funeral homes
                </p>
              </div>
            </CardBody>
          </Card>
        </m.div>
        </Link>

        <Link to="/cemeteries" className="contents">
          <m.div variants={fadeInUp} className="h-full">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Graves Mapped</p>
                <div className="p-1.5 bg-primary-100 dark:bg-primary-950 rounded-lg">
                  <Layers size={14} className="text-primary" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.capacity.gravesTotal} /></p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {stats.capacity.lotsTotal} lots · {stats.sectionsInUse} sections
                </p>
              </div>
            </CardBody>
          </Card>
        </m.div>
        </Link>

        <Link to="/customers" className="contents">
          <m.div variants={fadeInUp} className="h-full">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Customers</p>
                <div className="p-1.5 bg-info-100 dark:bg-info-950 rounded-lg">
                  <Users size={14} className="text-info" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.customerCount} /></p>
                <p className="text-xs text-foreground-muted mt-0.5">next of kin on record</p>
              </div>
            </CardBody>
          </Card>
        </m.div>
        </Link>

        <Link to="/vendors" className="contents">
          <m.div variants={fadeInUp} className="h-full">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Vendors</p>
                <div className="p-1.5 bg-success-100 dark:bg-success-950 rounded-lg">
                  <Truck size={14} className="text-success" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.vendorCount} /></p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {formatCurrency(stats.vendorSpendKnown)} known spend
                </p>
              </div>
            </CardBody>
          </Card>
        </m.div>
        </Link>

        <Link to="/burials" className="contents">
          <m.div variants={fadeInUp} className="h-full">
          <Card hoverable className="h-full">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Median Age</p>
                <div className="p-1.5 bg-info-100 dark:bg-info-950 rounded-lg">
                  <Activity size={14} className="text-info" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {stats.medianAgeAtDeath !== null ? stats.medianAgeAtDeath : '—'}
                </p>
                <p className="text-xs text-foreground-muted mt-0.5">at death</p>
              </div>
            </CardBody>
          </Card>
        </m.div>
        </Link>
      </m.div>

      {/*
        Modules whose source tables are still empty. They keep their place and
        their link rather than showing a zero that reads as a broken query, and
        each becomes a live card the moment its table has rows.
      */}
      <m.div
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/*
          Gated on table population, not on a filtered figure. `activeContracts`
          goes to zero once every contract is paid, which is a healthy state,
          not an empty table.
        */}
        {loaded.contracts ? (
          <Link to="/contracts" className="contents">
            <m.div variants={fadeInUp} className="h-full">
            <Card hoverable className="h-full">
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Contracts</p>
                  <div className="p-1.5 bg-info-100 dark:bg-info-950 rounded-lg">
                    <FileText size={14} className="text-info" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.activeContracts} /></p>
                  <p className="text-xs text-foreground-muted mt-0.5">{formatCurrency(stats.contractsValue)}</p>
                </div>
              </CardBody>
            </Card>
          </m.div>
          </Link>
        ) : (
          <PendingCard to="/contracts" label="Contracts" icon={FileText}
            note="blocked: no purchaser link in source" />
        )}

        {/* `unpaidAR` is zero for a business that has collected everything. */}
        {loaded.receivables ? (
          <Link to="/financial" className="contents">
            <m.div variants={fadeInUp} className="h-full">
            <Card hoverable className={`h-full ${stats.overdueAR > 0 ? 'border-warning' : ''}`}>
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Receivables</p>
                  <div className={`p-1.5 rounded-lg ${stats.overdueAR > 0 ? 'bg-warning-100 dark:bg-warning-950' : 'bg-success-100 dark:bg-success-950'}`}>
                    <DollarSign size={14} className={stats.overdueAR > 0 ? 'text-warning' : 'text-success'} />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.arOutstanding} format={formatCurrency} /></p>
                  <p className="text-xs text-foreground-muted mt-0.5">{stats.unpaidAR} open</p>
                </div>
              </CardBody>
            </Card>
          </m.div>
          </Link>
        ) : (
          <PendingCard to="/financial" label="Receivables" icon={DollarSign}
            note="awaiting AR import" />
        )}

        {loaded.workOrders ? (
          <Link to="/work-orders" className="contents">
            <m.div variants={fadeInUp} className="h-full">
            <Card hoverable className="h-full">
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Work Orders</p>
                  <div className="p-1.5 bg-info-100 dark:bg-info-950 rounded-lg">
                    <ClipboardList size={14} className="text-info" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.totalWO} /></p>
                  <p className="text-xs text-foreground-muted mt-0.5">{stats.activeWO} in progress</p>
                </div>
              </CardBody>
            </Card>
          </m.div>
          </Link>
        ) : (
          <PendingCard to="/work-orders" label="Work Orders" icon={ClipboardList}
            note="none recorded yet" />
        )}

        {loaded.inventory ? (
          <Link to="/inventory" className="contents">
            <m.div variants={fadeInUp} className="h-full">
            <Card hoverable className={`h-full ${stats.lowStock > 0 ? 'border-warning' : ''}`}>
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Inventory</p>
                  <div className={`p-1.5 rounded-lg ${stats.lowStock > 0 ? 'bg-warning-100 dark:bg-warning-950' : 'bg-success-100 dark:bg-success-950'}`}>
                    <Package size={14} className={stats.lowStock > 0 ? 'text-warning' : 'text-success'} />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.totalInventory} /></p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {stats.lowStock > 0 ? `${stats.lowStock} low stock` : 'All stocked'}
                  </p>
                </div>
              </CardBody>
            </Card>
          </m.div>
          </Link>
        ) : (
          <PendingCard to="/inventory" label="Inventory" icon={Package}
            note="awaiting stock import" />
        )}

        {/*
          "Deposits", never "Revenue". This sums cash received against invoices;
          it is a booking/cash measure, not recognised revenue, and labelling it
          otherwise would put a number on the dashboard that no accountant would
          sign.
        */}
        {/*
          `revenue30d` only looks back 30 days. Every DMP dataset so far is
          2020, so gating on it would load thousands of deposits and still show
          "Not loaded" — indistinguishable from a failed import.
        */}
        {loaded.deposits ? (
          <Link to="/financial" className="contents">
            <m.div variants={fadeInUp} className="h-full">
            <Card hoverable className="h-full">
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">Deposits (30d)</p>
                  <div className="p-1.5 bg-success-100 dark:bg-success-950 rounded-lg">
                    <TrendingUp size={14} className="text-success" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground"><AnimatedNumber to={stats.revenue30d} format={formatCurrency} /></p>
                  <p className="text-xs text-foreground-muted mt-0.5 inline-flex items-center gap-1">
                    cash received
                    {stats.revenuePrior30d > 0 && stats.revenue30d !== stats.revenuePrior30d && (
                      stats.revenue30d > stats.revenuePrior30d
                        ? <TrendingUp size={11} className="text-success" />
                        : <TrendingDown size={11} className="text-warning" />
                    )}
                    {stats.revenuePrior30d > 0 && (
                      <span className="text-foreground-subtle">vs {formatCurrency(stats.revenuePrior30d)}</span>
                    )}
                  </p>
                </div>
              </CardBody>
            </Card>
          </m.div>
          </Link>
        ) : (
          <PendingCard to="/financial" label="Deposits (30d)" icon={DollarSign}
            note="awaiting deposit import" />
        )}
      </m.div>

      {/* ── Charts Row 1: Interment Trend + Age at Death ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Interments per Month</h3>
              {/*
                The window anchors on the newest interment, not on today. Saying
                so is the whole point: a "last 12 months" chart that silently
                ends in 2020 would be read as this year's volume.
              */}
              <p className="text-xs text-foreground-muted mt-0.5">
                {periodLabel(stats.dataAsOf, monthsBack)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Tabs
                tabs={[{ value: '6', label: '6M' }, { value: '12', label: '12M' }, { value: '24', label: '24M' }]}
                active={String(monthsBack)}
                onChange={(v) => setMonthsBack(Number(v))}
              />
              <Badge variant="secondary" size="sm">{stats.burialsTrailing12} in 12 mo</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {hasInterments ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={burialTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="burialGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.green} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
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
            ) : (
              <div className="h-[220px] flex items-center justify-center text-foreground-muted text-sm">
                No interments recorded yet
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Age at Death</h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              {stats.medianAgeAtDeath !== null
                ? `median ${stats.medianAgeAtDeath} years`
                : 'no ages recorded'}
            </p>
          </CardHeader>
          <CardBody>
            {hasInterments ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ageBandData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Interments" fill={C.info} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-foreground-muted text-sm">
                No age data yet
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Charts Row 2: Referral Channel + Vendor Spend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              {/*
                Title states the finding, not the topic. Referral concentration
                is the risk: losing one relationship removes a quarter of
                volume.
              */}
              <h3 className="font-semibold text-foreground">Where interments come from</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {stats.referralTop5Pct !== null
                  ? `top 5 of ${stats.distinctFuneralHomes} homes account for ${stats.referralTop5Pct}%`
                  : 'no referral data yet'}
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {referralData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={referralData} layout="vertical" margin={{ top: 0, right: 12, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Interments" fill={C.gold} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[230px] flex items-center justify-center text-foreground-muted text-sm">
                No referral data yet
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Vendor Spend by Category</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {formatCurrency(stats.vendorSpendKnown)} known across {stats.vendorCount} vendors · 2020–2024
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {vendorSpendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={vendorSpendData} layout="vertical" margin={{ top: 0, right: 12, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Bar dataKey="Spend" fill={C.green} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[230px] flex items-center justify-center text-foreground-muted text-sm">
                No vendor spend recorded yet
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Who handled the work, and where it went ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Counselor attribution</h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              arrangements credited, {periodLabel(stats.dataAsOf, monthsBack).replace(/^\d+ months to /, 'to ')}
            </p>
          </CardHeader>
          <CardBody>
            <RankedList rows={stats.topCounselors} empty="No counselor data yet" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Busiest sections</h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              {stats.sectionsInUse} sections hold interments
            </p>
          </CardHeader>
          <CardBody>
            <RankedList rows={stats.topSections} empty="No section data yet" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-foreground">Largest vendors</h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              by known spend, 2020–2024
            </p>
          </CardHeader>
          <CardBody>
            {stats.topVendorsBySpend.length > 0 ? (
              <div className="space-y-2.5">
                {stats.topVendorsBySpend.map((v) => (
                  <div key={v.name} className="flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-foreground-muted" title={v.name}>{v.name}</p>
                      {v.category && (
                        <p className="text-[11px] text-foreground-subtle truncate">{v.category}</p>
                      )}
                    </div>
                    <span className="font-medium text-foreground tabular-nums shrink-0">
                      {formatCurrency(v.spend)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted text-center py-6">No vendor spend recorded yet</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Charts Row 3: modules still awaiting their data ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              {/* Deposits, not Revenue — see the KPI card comment. */}
              <h3 className="font-semibold text-foreground">Monthly Deposits</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                cash received, not recognised revenue
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {loaded.deposits ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={revenueTrend} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={C.gold} stopOpacity={1} />
                      <stop offset="100%" stopColor={C.gold} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Bar dataKey="Revenue" fill="url(#revenueGrad)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-foreground-muted text-sm text-center px-4">
                No deposits recorded yet
              </div>
            )}
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
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={inventoryCategoryData} layout="vertical" margin={{ top: 0, right: 8, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: chart.tick }} axisLine={false} tickLine={false} width={58} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Items" fill={C.green} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-foreground-muted text-sm">
                No inventory data yet
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/*
        Capacity is reported, never scored. Occupancy carries no direction: every
        grave here is occupied, and high occupancy means less left to sell, not
        better performance. Runway — available spaces ÷ annual absorption — is
        the metric that would matter, and it is genuinely not computable from
        what was imported, so the card says why instead of showing a figure.
      */}
      {stats.capacity.runwayReason && (
        <Card>
          <CardBody className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-background-subtle rounded-lg">
                <Layers size={16} className="text-foreground-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Capacity runway unavailable
                </p>
                <p className="text-xs text-foreground-muted mt-0.5 max-w-2xl">
                  {stats.capacity.runwayReason}
                </p>
              </div>
            </div>
            <div className="text-sm text-foreground-muted shrink-0">
              {stats.capacity.gravesOccupied} of {stats.capacity.gravesTotal} mapped graves occupied
            </div>
          </CardBody>
        </Card>
      )}

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
