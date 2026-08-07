import { useMemo, useState, lazy, Suspense, type ReactNode } from 'react';
const LocationsMap = lazy(() => import('../components/LocationsMap'));
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  ClipboardList, Package, DollarSign, Users, AlertCircle,
  TrendingUp, TrendingDown, BookOpen, FileText, Activity, Zap, Gift,
  Share2, Layers, Truck, Landmark, Tag, CalendarClock,
} from 'lucide-react';
import {
  useDashboardSummary, useBurialTrend, useRevenueTrend, useContractTrend,
  useRecentWorkOrders, useRecentBurials,
} from '../hooks/useData';
import {
  burialTrendSeries, revenueTrendSeries, workOrderChartData,
  inventoryCategoryData as buildInventoryCategoryData,
  referralSeries, ageBandSeries, vendorSpendSeries, modulesLoaded,
  formatMonthYear, periodLabel,
  contractTrendSeries, cemeterySalesSeries, yearSalesSeries,
  productSeries, valueBandSeries, SALES_TREND_YEARS,
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
  /**
   * The at-need / pre-need pair.
   *
   * Chosen to differ in lightness as well as hue, so the stacked columns stay
   * separable for a red-green colour-blind reader and in greyscale print. Both
   * clear 3:1 against the card background in either theme.
   */
  atNeed: '#1a3d2b',
  preNeed: '#c49a2c',
};

/** Grid/tick colors per resolved theme so dark mode stops rendering light-gray gridlines. */
const CHART_THEME = {
  light: { tick: '#94a3b8', grid: '#e2e8f0', empty: '#e2e8f0' },
  dark:  { tick: '#64748b', grid: '#334155', empty: '#334155' },
} as const;

/** Abbreviate an axis figure: 43528654 → `$43.5M`. */
function compactMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

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
        <p key={i} className="font-semibold tabular-nums" style={{ color: p.color }}>
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
  sales: {
    dataAsOf: null, earliestSignedDate: null,
    contracts: 0, lines: 0, value: 0, avgValue: null, linesPerContract: null,
    preNeedContracts: 0, preNeedValue: 0, preNeedSharePct: null,
    byCemetery: [], byYear: [], topProducts: [], distinctProducts: 0,
    topSalespeople: [], valueBands: {},
  },
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

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

/**
 * A labelled band of the dashboard.
 *
 * The page carries four distinct subjects — sales, interments, the grounds, and
 * modules with no data yet — and read as one flat scroll they blur into each
 * other. The heading also gives each band somewhere to state its own period,
 * which matters because the contract ledger and the interment register end
 * years apart.
 */
function Section({
  title, caption, aside, children,
}: {
  title: string;
  caption?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {caption && <p className="text-xs text-foreground-muted mt-0.5">{caption}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

const TONE = {
  primary: 'bg-primary-100 dark:bg-primary-950 text-primary',
  info: 'bg-info-100 dark:bg-info-950 text-info',
  success: 'bg-success-100 dark:bg-success-950 text-success',
  warning: 'bg-warning-100 dark:bg-warning-950 text-warning',
  gold: '',
} as const;

/**
 * One KPI card.
 *
 * `value` and `sub` are nodes rather than strings because the variations
 * between cards are real — an animated figure here, a trend arrow there, a
 * currency format somewhere else — and squeezing them into flags would turn
 * this into configuration soup. What is shared is the frame: the same padding,
 * the same label treatment, the same figure size, and `tabular-nums` on every
 * number so a column of cards does not jitter as values animate.
 */
function StatCard({
  to, label, icon: Icon, tone, value, sub, highlight,
}: {
  to: string;
  label: string;
  icon: typeof BookOpen;
  tone: keyof typeof TONE;
  value: ReactNode;
  sub: ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link to={to} className="contents">
      <m.div variants={fadeInUp} className="h-full">
        <Card hoverable className={`h-full ${highlight ? 'border-warning' : ''}`}>
          <CardBody className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide">
                {label}
              </p>
              <div
                className={`p-1.5 rounded-lg ${TONE[tone]}`}
                style={tone === 'gold'
                  ? { backgroundColor: 'rgba(196,154,44,0.14)', color: BRAND.gold }
                  : undefined}
              >
                <Icon size={14} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground tabular-nums leading-none">{value}</p>
              <div className="text-xs text-foreground-muted mt-1.5">{sub}</div>
            </div>
          </CardBody>
        </Card>
      </m.div>
    </Link>
  );
}

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

/** One row of a {@link RankedList}. */
interface RankRow {
  name: string;
  /** What the bar is scaled by. */
  value: number;
  /** How the figure is written out — a count, or a formatted amount. */
  display: string;
  /** An optional second line under the name. */
  note?: string;
}

/**
 * A compact ranked list with a proportional bar.
 *
 * Used where a chart would be overkill: six rows read faster as a list than as
 * another axis, and the bar carries the proportion without spending a card's
 * whole height on it. Bars are scaled to the largest row, so the comparison
 * stays within the list and never implies a share of some total the list does
 * not show.
 */
function RankedList({ rows, empty, tint = BRAND.green }: {
  rows: RankRow[];
  empty: string;
  tint?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-6">{empty}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3 text-sm">
          <div className="flex-1 min-w-0">
            <p className="truncate text-foreground-muted" title={r.name}>{r.name}</p>
            {r.note && <p className="text-[11px] text-foreground-subtle truncate">{r.note}</p>}
          </div>
          <div className="w-16 h-1.5 rounded-full bg-background-subtle overflow-hidden shrink-0">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, backgroundColor: tint }}
            />
          </div>
          <span className="w-20 text-right font-medium text-foreground tabular-nums shrink-0">
            {r.display}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Map the `{name, n}` shape the RPC returns for counted dimensions. */
const countRows = (rows: NamedCount[]): RankRow[] =>
  rows.map((r) => ({ name: r.name, value: r.n, display: String(r.n) }));

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
  const contractTrendQ = useContractTrend(monthsBack);
  // The activity feed is the one thing the RPC does not cover. It reads the
  // newest few rows with a database-side LIMIT rather than downloading a table.
  const recentWorkOrdersQ = useRecentWorkOrders(RECENT_WORK_ORDERS);
  const recentBurialsQ = useRecentBurials(RECENT_BURIALS);

  const { resolvedTheme } = useTheme();
  const chart = CHART_THEME[resolvedTheme === 'dark' ? 'dark' : 'light'];

  const isLoading =
    summaryQ.isLoading || burialTrendQ.isLoading ||
    revenueTrendQ.isLoading || contractTrendQ.isLoading;
  // Any one query failing shows its message above a page that still renders:
  // the others' data is still good, and a blank dashboard tells staff nothing.
  const combinedError =
    summaryQ.error || burialTrendQ.error || revenueTrendQ.error || contractTrendQ.error ||
    recentWorkOrdersQ.error || recentBurialsQ.error;

  // Freeze "now" for the component's lifetime so the hero's date stays stable.
  const now = useMemo(() => new Date(), []);

  // ── KPI stats ──────────────────────────────────────────────
  const stats = summaryQ.data ?? EMPTY_SUMMARY;
  const sales = stats.sales;

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

  const contractTrend = useMemo(
    () => contractTrendSeries(contractTrendQ.data ?? []),
    [contractTrendQ.data],
  );

  const cemeteryRows = useMemo(() => cemeterySalesSeries(sales.byCemetery), [sales.byCemetery]);
  const yearMix = useMemo(() => yearSalesSeries(sales.byYear), [sales.byYear]);
  const productRows = useMemo(() => productSeries(sales.topProducts), [sales.topProducts]);
  const valueBands = useMemo(() => valueBandSeries(sales.valueBands), [sales.valueBands]);

  const salespeopleRows = useMemo<RankRow[]>(
    () => sales.topSalespeople.map((s) => ({
      name: s.name,
      value: s.value,
      display: compactMoney(s.value),
      note: `${s.contracts.toLocaleString()} contracts`,
    })),
    [sales.topSalespeople],
  );

  const vendorRows = useMemo<RankRow[]>(
    () => stats.topVendorsBySpend.map((v) => ({
      name: v.name,
      value: v.spend,
      display: compactMoney(v.spend),
      note: v.category ?? undefined,
    })),
    [stats.topVendorsBySpend],
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
  // without it. Sales carries its own — the ledger runs years past the register.
  const asOf = formatMonthYear(stats.dataAsOf);
  const salesAsOf = formatMonthYear(sales.dataAsOf);
  const hasInterments = stats.totalInterments > 0;
  // Population, not filtered figures — see modulesLoaded for why.
  const loaded = modulesLoaded(stats);
  const hasSales = sales.contracts > 0;

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
    <div className="space-y-8">

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
                <p className="font-bold text-lg mt-0.5 tabular-nums" style={{ color: C.gold }}>
                  {now.getFullYear() - COMPANY.established}+ Years
                </p>
                <p className="text-white/50 text-xs">Since {COMPANY.established}</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Contracts</p>
                <p className="text-white font-bold text-2xl mt-0.5 tabular-nums">
                  {sales.contracts.toLocaleString()}
                </p>
                <p className="text-white/50 text-xs">
                  {hasSales ? `${compactMoney(sales.value)} sale value` : 'none loaded'}
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Interments</p>
                <p className="text-white font-bold text-2xl mt-0.5 tabular-nums">
                  {stats.totalInterments.toLocaleString()}
                </p>
                <p className="text-white/50 text-xs">
                  {yearSpan ? `across ${yearSpan}` : 'none recorded'}
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest">Sections</p>
                <p className="text-white font-bold text-2xl mt-0.5 tabular-nums">{stats.sectionsInUse}</p>
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

      {/* ═══════════════════════════════════════════════════════════════════
          SALES — the contract ledger

          Every figure in this section is *booked sale value*: the sum of
          settled contracts from the CemSites paid-in-full register. That is a
          cash/booking measure, not recognised revenue — a pre-need contract is
          collected years before the service is delivered, and trust and
          perpetual-care components sit inside these totals. Nothing here is
          titled "Revenue", and the section caption says so once so every card
          under it inherits the qualifier.
          ═══════════════════════════════════════════════════════════════════ */}
      <Section
        title="Sales"
        caption={
          <>
            Booked sale value from settled contracts — not recognised revenue.{' '}
            {salesAsOf ? `Ledger runs to ${salesAsOf}.` : 'No contracts loaded.'}
          </>
        }
        aside={hasSales && (
          <Badge variant="secondary" size="sm">
            {sales.lines.toLocaleString()} lines · {sales.linesPerContract ?? '—'} per contract
          </Badge>
        )}
      >
        <m.div
          className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {hasSales ? (
            <>
              <StatCard
                to="/contracts" label="Contracts" icon={FileText} tone="info"
                value={<AnimatedNumber to={sales.contracts} />}
                sub={<>settled, across {sales.byCemetery.length} location{sales.byCemetery.length !== 1 ? 's' : ''}</>}
              />
              <StatCard
                to="/contracts" label="Sale Value" icon={Landmark} tone="gold"
                value={compactMoney(sales.value)}
                sub="booked, not recognised revenue"
              />
              <StatCard
                to="/contracts" label="Avg Contract" icon={Tag} tone="primary"
                value={sales.avgValue !== null ? formatCurrency(sales.avgValue) : '—'}
                sub={<>{sales.distinctProducts.toLocaleString()} distinct product codes</>}
              />
              {/*
                The forward order book. Reported as a share of contracts with
                the value beside it, because the two differ — a pre-need
                contract is typically larger than an at-need one, so a single
                percentage would answer only half the question.
              */}
              <StatCard
                to="/contracts" label="Pre-need Share" icon={CalendarClock} tone="success"
                value={sales.preNeedSharePct !== null ? `${sales.preNeedSharePct}%` : '—'}
                sub={<>
                  {sales.preNeedContracts.toLocaleString()} contracts ·{' '}
                  {compactMoney(sales.preNeedValue)} collected ahead
                </>}
              />
            </>
          ) : (
            <>
              <PendingCard to="/contracts" label="Contracts" icon={FileText} note="awaiting contract import" />
              <PendingCard to="/contracts" label="Sale Value" icon={Landmark} note="awaiting contract import" />
              <PendingCard to="/contracts" label="Avg Contract" icon={Tag} note="awaiting contract import" />
              <PendingCard to="/contracts" label="Pre-need Share" icon={CalendarClock} note="awaiting contract import" />
            </>
          )}
        </m.div>

        {/* Contracts written per month + how large they are */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">Contracts written per month</h3>
                {/*
                  Grouped by signed date — when the sale happened — not by when
                  the contract was paid off. The export is one file per payment
                  year, so grouping the other way would draw a chart that is
                  flat by construction and call it sales.
                */}
                <p className="text-xs text-foreground-muted mt-0.5">
                  by date signed · {periodLabel(sales.dataAsOf, monthsBack)}
                </p>
              </div>
              <Tabs
                tabs={[{ value: '6', label: '6M' }, { value: '12', label: '12M' }, { value: '24', label: '24M' }]}
                active={String(monthsBack)}
                onChange={(v) => setMonthsBack(Number(v))}
              />
            </CardHeader>
            <CardBody>
              {hasSales ? (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={contractTrend} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.gold} stopOpacity={0.38} />
                        <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis
                      tick={{ fontSize: 11, fill: chart.tick }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={compactMoney}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Area
                      type="monotone"
                      dataKey="Sale value"
                      stroke={C.gold}
                      strokeWidth={2.5}
                      fill="url(#saleGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: C.gold, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[230px] flex items-center justify-center text-foreground-muted text-sm">
                  No contracts loaded yet
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Most contracts are small</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {sales.avgValue !== null
                  ? `${formatCurrency(sales.avgValue)} average, with a long tail above it`
                  : 'no contracts loaded'}
              </p>
            </CardHeader>
            <CardBody>
              {hasSales ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={valueBands} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="band" tick={{ fontSize: 9, fill: chart.tick }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={46} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Contracts" fill={C.info} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[230px] flex items-center justify-center text-foreground-muted text-sm">
                  No contracts loaded yet
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Where the book sits, and how the need-type mix has moved */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Where the book sits</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {cemeteryRows.length > 0
                  ? 'sale value by location, with the average contract behind it'
                  : 'no contracts loaded'}
              </p>
            </CardHeader>
            <CardBody>
              {cemeteryRows.length > 0 ? (
                // Three rows. A chart axis would spend 230px to compare three
                // numbers the reader can hold in their head; what they cannot
                // hold is the *spread* — a location can be third by total and
                // first by average contract, and that is the finding.
                <div className="space-y-4">
                  {cemeteryRows.map((c) => {
                    const share = sales.value > 0 ? (c['Sale value'] / sales.value) * 100 : 0;
                    return (
                      <div key={c.name}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-medium text-foreground truncate" title={c.name}>
                            {c.short}
                          </p>
                          <p className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                            {compactMoney(c['Sale value'])}
                          </p>
                        </div>
                        <div className="h-2 rounded-full bg-background-subtle overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${share}%`, backgroundColor: BRAND.green }}
                          />
                        </div>
                        <p className="text-[11px] text-foreground-subtle mt-1 tabular-nums">
                          {c.Contracts.toLocaleString()} contracts ·{' '}
                          {formatCurrency(c.avgValue)} avg ·{' '}
                          {c.preNeedPct.toFixed(1)}% pre-need ·{' '}
                          {share.toFixed(0)}% of book
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-foreground-muted text-center py-10">No contracts loaded yet</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">At-need dominates the mix</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                contracts by year signed
                {yearMix.omittedYears > 0 && (
                  <>
                    {' '}· showing the last {SALES_TREND_YEARS} years;{' '}
                    {yearMix.omittedContracts.toLocaleString()} older contract
                    {yearMix.omittedContracts !== 1 ? 's' : ''} across{' '}
                    {yearMix.omittedYears} earlier year
                    {yearMix.omittedYears !== 1 ? 's' : ''} not shown
                  </>
                )}
              </p>
            </CardHeader>
            <CardBody>
              {yearMix.series.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={yearMix.series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: chart.tick, paddingTop: 4 }}
                    />
                    <Bar dataKey="At-need" stackId="need" fill={C.atNeed} />
                    <Bar dataKey="Pre-need" stackId="need" fill={C.preNeed} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[230px] flex items-center justify-center text-foreground-muted text-sm">
                  No contracts loaded yet
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* What sells, and who writes it */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">What the money is spent on</h3>
              {/*
                Codes exactly as CemSites records them. The export defines no
                expansion for SRVM or MINC, and inventing readable names would
                put invented products on the page — see migration 20260807014352.
              */}
              <p className="text-xs text-foreground-muted mt-0.5">
                top product codes by sale value · as recorded in CemSites
              </p>
            </CardHeader>
            <CardBody>
              {productRows.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={productRows} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.6} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: chart.tick }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={compactMoney}
                    />
                    <YAxis
                      type="category"
                      dataKey="code"
                      tick={{ fontSize: 11, fill: chart.tick }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="Sale value" fill={C.green} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-foreground-muted text-sm">
                  No contract lines loaded yet
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Who writes the business</h3>
              {/*
                A credit tag, not a staff reference: one value is the cemetery
                itself as a house account, and many lines carry no salesperson
                at all.
              */}
              <p className="text-xs text-foreground-muted mt-0.5">
                by sale value credited · includes house accounts
              </p>
            </CardHeader>
            <CardBody>
              <RankedList
                rows={salespeopleRows}
                empty="No salesperson data yet"
                tint={BRAND.gold}
              />
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════
          INTERMENTS — the burial register
          ═══════════════════════════════════════════════════════════════════ */}
      <Section
        title="Interments"
        caption={asOf
          ? `The burial register runs to ${asOf}${yearSpan ? `, covering ${yearSpan}` : ''}.`
          : 'No interments recorded.'}
        aside={hasInterments && (
          <Badge variant="secondary" size="sm">{stats.burialsTrailing12} in trailing 12 mo</Badge>
        )}
      >
        <m.div
          className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <StatCard
            to="/burials" label="Interments" icon={BookOpen} tone="primary"
            value={<AnimatedNumber to={stats.totalInterments} />}
            sub={
              /*
                Month over month against the anchor, not against the calendar.
                The arrow is deliberately not coloured as good/bad: fewer
                interments in a month is not a business failure, and flagging it
                as one would be exactly the kind of unjustified direction the
                cemetery scorecard rules warn about.
              */
              <span className="inline-flex items-center gap-1 flex-wrap">
                {asOf ? `through ${asOf}` : 'none on record'}
                {asOf && stats.burialsLatestMonth !== stats.burialsPriorMonth && (
                  stats.burialsLatestMonth > stats.burialsPriorMonth
                    ? <TrendingUp size={11} className="text-foreground-subtle" />
                    : <TrendingDown size={11} className="text-foreground-subtle" />
                )}
                {asOf && (
                  <span className="text-foreground-subtle tabular-nums">
                    {stats.burialsLatestMonth} vs {stats.burialsPriorMonth} prior mo
                  </span>
                )}
              </span>
            }
          />

          {/* Concentration, not the leader's name: one home leaving is the risk. */}
          <StatCard
            to="/burials" label="Top 5 Referrers" icon={Share2} tone="warning"
            value={stats.referralTop5Pct !== null ? `${stats.referralTop5Pct}%` : '—'}
            sub={<>of {stats.distinctFuneralHomes} funeral homes</>}
          />

          <StatCard
            to="/burials" label="Median Age" icon={Activity} tone="info"
            value={stats.medianAgeAtDeath !== null ? stats.medianAgeAtDeath : '—'}
            sub="at death"
          />

          <StatCard
            to="/customers" label="Customers" icon={Users} tone="info"
            value={<AnimatedNumber to={stats.customerCount} />}
            sub="purchasers and next of kin"
          />
        </m.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <h3 className="font-semibold text-foreground">Interments per month</h3>
              {/*
                The window anchors on the newest interment, not on today. Saying
                so is the whole point: a "last 12 months" chart that silently
                ends in 2020 would be read as this year's volume.
              */}
              <p className="text-xs text-foreground-muted mt-0.5">
                {periodLabel(stats.dataAsOf, monthsBack)}
              </p>
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
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} minTickGap={16} />
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
              <h3 className="font-semibold text-foreground">Age at death</h3>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              {/*
                Title states the finding, not the topic. Referral concentration
                is the risk: losing one relationship removes a quarter of volume.
              */}
              <h3 className="font-semibold text-foreground">Where interments come from</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {stats.referralTop5Pct !== null
                  ? `top 5 of ${stats.distinctFuneralHomes} homes account for ${stats.referralTop5Pct}%`
                  : 'no referral data yet'}
              </p>
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
                      width={140}
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
            <CardHeader>
              <h3 className="font-semibold text-foreground">Counselor attribution</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                arrangements credited{asOf ? `, to ${asOf}` : ''}
              </p>
            </CardHeader>
            <CardBody>
              <RankedList rows={countRows(stats.topCounselors)} empty="No counselor data yet" />
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE GROUNDS
          ═══════════════════════════════════════════════════════════════════ */}
      <Section
        title="The grounds"
        caption="Mapped plots and where interments sit. Occupancy is reported, never scored."
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Busiest sections</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {stats.sectionsInUse} sections hold interments
              </p>
            </CardHeader>
            <CardBody>
              <RankedList rows={countRows(stats.topSections)} empty="No section data yet" />
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <h3 className="font-semibold text-foreground">Mapped capacity</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {stats.capacity.lotsTotal.toLocaleString()} lots ·{' '}
                {stats.capacity.gravesTotal.toLocaleString()} graves ·{' '}
                {stats.sectionsInUse} sections
              </p>
            </CardHeader>
            <CardBody>
              {/*
                Capacity is reported, never scored. Occupancy carries no
                direction: every grave here is occupied, and high occupancy
                means less left to sell, not better performance. Runway —
                available spaces ÷ annual absorption — is the metric that would
                matter, and it is genuinely not computable from what was
                imported, so the card says why instead of showing a figure.
              */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-background-subtle rounded-lg shrink-0">
                  <Layers size={16} className="text-foreground-muted" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Capacity runway unavailable
                  </p>
                  <p className="text-xs text-foreground-muted mt-1 max-w-2xl">
                    {stats.capacity.runwayReason
                      ?? 'Runway needs a plot register that includes unsold spaces.'}
                  </p>
                  <p className="text-xs text-foreground-subtle mt-2 tabular-nums">
                    {stats.capacity.gravesOccupied.toLocaleString()} of{' '}
                    {stats.capacity.gravesTotal.toLocaleString()} mapped graves occupied
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">DMP locations</h3>
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
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════
          OPERATIONS & SUPPLIERS
          ═══════════════════════════════════════════════════════════════════ */}
      <Section
        title="Operations & suppliers"
        caption="Day-to-day work, stock and the money moving through the ledger."
      >
        <m.div
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <StatCard
            to="/vendors" label="Vendors" icon={Truck} tone="success"
            value={<AnimatedNumber to={stats.vendorCount} />}
            sub={<>{compactMoney(stats.vendorSpendKnown)} known spend</>}
          />

          {/* `unpaidAR` is zero for a business that has collected everything. */}
          {loaded.receivables ? (
            <StatCard
              to="/financial" label="Receivables" icon={DollarSign}
              tone={stats.overdueAR > 0 ? 'warning' : 'success'}
              highlight={stats.overdueAR > 0}
              value={<AnimatedNumber to={stats.arOutstanding} format={formatCurrency} />}
              sub={<>{stats.unpaidAR} open</>}
            />
          ) : (
            <PendingCard to="/financial" label="Receivables" icon={DollarSign}
              note="awaiting AR import" />
          )}

          {loaded.workOrders ? (
            <StatCard
              to="/work-orders" label="Work Orders" icon={ClipboardList} tone="info"
              value={<AnimatedNumber to={stats.totalWO} />}
              sub={<>{stats.activeWO} in progress</>}
            />
          ) : (
            <PendingCard to="/work-orders" label="Work Orders" icon={ClipboardList}
              note="none recorded yet" />
          )}

          {loaded.inventory ? (
            <StatCard
              to="/inventory" label="Inventory" icon={Package}
              tone={stats.lowStock > 0 ? 'warning' : 'success'}
              highlight={stats.lowStock > 0}
              value={<AnimatedNumber to={stats.totalInventory} />}
              sub={stats.lowStock > 0 ? `${stats.lowStock} low stock` : 'All stocked'}
            />
          ) : (
            <PendingCard to="/inventory" label="Inventory" icon={Package}
              note="awaiting stock import" />
          )}

          {/*
            "Deposits", never "Revenue". This sums cash received against
            invoices; it is a booking/cash measure, not recognised revenue.

            `revenue30d` only looks back 30 days, so the card is gated on table
            population instead — a 2020 deposit ledger would otherwise load
            thousands of rows and still read "Not loaded".
          */}
          {loaded.deposits ? (
            <StatCard
              to="/financial" label="Deposits (30d)" icon={TrendingUp} tone="success"
              value={<AnimatedNumber to={stats.revenue30d} format={formatCurrency} />}
              sub={
                <span className="inline-flex items-center gap-1">
                  cash received
                  {stats.revenuePrior30d > 0 && stats.revenue30d !== stats.revenuePrior30d && (
                    stats.revenue30d > stats.revenuePrior30d
                      ? <TrendingUp size={11} className="text-success" />
                      : <TrendingDown size={11} className="text-warning" />
                  )}
                  {stats.revenuePrior30d > 0 && (
                    <span className="text-foreground-subtle tabular-nums">
                      vs {formatCurrency(stats.revenuePrior30d)}
                    </span>
                  )}
                </span>
              }
            />
          ) : (
            <PendingCard to="/financial" label="Deposits (30d)" icon={DollarSign}
              note="awaiting deposit import" />
          )}
        </m.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Work order status</h3>
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
            <CardHeader>
              {/* Deposits, not Revenue — see the KPI card comment. */}
              <h3 className="font-semibold text-foreground">Monthly deposits</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                cash received, not recognised revenue
              </p>
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
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis
                      tick={{ fontSize: 11, fill: chart.tick }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={compactMoney}
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
            <CardHeader>
              <h3 className="font-semibold text-foreground">Inventory by category</h3>
              <p className="text-xs text-foreground-muted mt-0.5">{stats.totalInventory} items on hand</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Vendor spend by category</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {formatCurrency(stats.vendorSpendKnown)} known across {stats.vendorCount} vendors · 2020–2024
              </p>
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
                      tickFormatter={compactMoney}
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

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground">Largest vendors</h3>
              <p className="text-xs text-foreground-muted mt-0.5">by known spend, 2020–2024</p>
            </CardHeader>
            <CardBody>
              <RankedList rows={vendorRows} empty="No vendor spend recorded yet" />
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ── Bottom Row: Activity | Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Recent activity</h3>
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
            <h3 className="font-semibold text-foreground">Quick actions</h3>
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
