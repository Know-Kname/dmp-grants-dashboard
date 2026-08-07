/**
 * Shape transforms between the dashboard RPCs and the Recharts series the
 * Dashboard page renders.
 *
 * These used to be `useMemo`s inside `Dashboard.tsx` that reduced seven
 * whole-table fetches. The aggregation now happens in Postgres
 * (`dashboard_summary()`), but the *presentation* rules did not change and are
 * easy to break silently — a status slice that should disappear at zero, a
 * category order that must not follow object key order. They live here so they
 * can be tested without rendering a chart.
 *
 * Colours are passed in rather than imported: the palette is the page's, and
 * keeping it there is what stops this module from becoming a second place where
 * brand colours are defined.
 */

import type {
  BurialTrendRow,
  CemeterySales,
  ContractTrendRow,
  ProductSales,
  Referral,
  RevenueTrendRow,
  YearSales,
} from './schemas';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Render a `YYYY-MM-DD` date as `Mon YYYY`.
 *
 * Parsed by splitting the string rather than with `new Date(iso)`: that
 * constructor reads a bare date as UTC midnight, so west of Greenwich
 * `'2020-12-31'` formats as December 30 — and the dashboard's whole point here
 * is to state the data's period correctly.
 *
 * @param iso A `YYYY-MM-DD` date, or null when there is no data.
 */
export function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month] = iso.split('-');
  const index = Number(month) - 1;
  if (!year || !MONTHS[index]) return null;
  return `${MONTHS[index]} ${year}`;
}

/**
 * The period label a windowed card sits under, e.g. `12 months to Dec 2020`.
 *
 * Windows anchor on the newest row rather than on today, so without this the
 * reader has no way to know a "trailing 12 months" figure ends six years ago.
 *
 * @param dataAsOf `dashboard_summary().dataAsOf`; null when nothing is loaded.
 * @param months   Width of the window in months.
 */
export function periodLabel(dataAsOf: string | null, months: number): string {
  const anchor = formatMonthYear(dataAsOf);
  return anchor ? `${months} months to ${anchor}` : 'no data loaded';
}

/** The unfiltered row counts that decide whether a module has data at all. */
export interface ModulePopulation {
  totalContracts: number;
  totalAR: number;
  totalDeposits: number;
  totalWO: number;
  totalInventory: number;
}

/** Which dashboard modules should render a live card rather than a placeholder. */
export interface ModulesLoaded {
  contracts: boolean;
  receivables: boolean;
  deposits: boolean;
  workOrders: boolean;
  inventory: boolean;
}

/**
 * Decide which modules have data — from table population only, never from a
 * filtered figure.
 *
 * This distinction is the whole reason the function exists. Three of these
 * cards previously asked a filtered question, and each one has a legitimate
 * state where the answer is zero while the table is full:
 *
 * - `activeContracts` is 0 once every contract is paid.
 * - `unpaidAR` is 0 once every invoice is settled — the state a business is
 *   *trying* to reach.
 * - `revenue30d` is 0 unless a deposit landed in the last 30 days, so a ledger
 *   imported from 2020 reads as empty however many rows it has.
 *
 * Reporting any of those as "not loaded" tells the user their import failed.
 */
export function modulesLoaded(counts: ModulePopulation): ModulesLoaded {
  return {
    contracts: counts.totalContracts > 0,
    receivables: counts.totalAR > 0,
    deposits: counts.totalDeposits > 0,
    workOrders: counts.totalWO > 0,
    inventory: counts.totalInventory > 0,
  };
}

/** A slice of the work-order donut. */
export interface WorkOrderSlice {
  name: string;
  value: number;
  color: string;
}

/** Colour per work-order status, plus the colour used for the empty state. */
export interface WorkOrderStatusColors {
  pending: string;
  in_progress: string;
  completed: string;
  cancelled: string;
  empty: string;
}

/**
 * Statuses in the order the donut and its legend present them, with the label
 * each one renders as. `dashboard_summary().workOrdersByStatus` is an unordered
 * object that omits statuses with no rows, so both the order and the zero
 * entries have to be reconstructed here.
 */
const WORK_ORDER_STATUSES = [
  { key: 'pending', name: 'Pending' },
  { key: 'in_progress', name: 'In Progress' },
  { key: 'completed', name: 'Completed' },
  { key: 'cancelled', name: 'Cancelled' },
] as const;

/**
 * Build the work-order donut series.
 *
 * Zero-valued slices are dropped, and when *everything* is zero the chart gets
 * a single placeholder slice — a Recharts pie with an empty data array renders
 * nothing at all, which reads as a broken card rather than an empty one.
 *
 * @param byStatus `workOrdersByStatus` from the summary RPC; absent keys are zero.
 * @param colors   Page palette, including the colour for the placeholder slice.
 */
export function workOrderChartData(
  byStatus: Record<string, number>,
  colors: WorkOrderStatusColors,
): WorkOrderSlice[] {
  const raw = WORK_ORDER_STATUSES
    .map(({ key, name }) => ({ name, value: byStatus[key] ?? 0, color: colors[key] }))
    .filter((d) => d.value > 0);
  return raw.length > 0 ? raw : [{ name: 'No Data', value: 1, color: colors.empty }];
}

/** A bar of the inventory-by-category chart. */
export interface InventoryCategoryBar {
  category: string;
  Items: number;
}

/**
 * The inventory categories, in the order the horizontal bar chart lists them.
 * Declared here rather than derived from the data because
 * `inventoryByCategory` is an unordered object — reading its keys would let the
 * chart reorder itself between refetches.
 */
export const INVENTORY_CATEGORIES = [
  'casket',
  'urn',
  'vault',
  'marker',
  'supplies',
  'other',
] as const;

/**
 * Build the inventory-by-category series: fixed order, capitalised label,
 * empty categories omitted.
 *
 * @param byCategory `inventoryByCategory` from the summary RPC; absent keys are zero.
 */
export function inventoryCategoryData(
  byCategory: Record<string, number>,
): InventoryCategoryBar[] {
  return INVENTORY_CATEGORIES
    .map((cat) => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      Items: byCategory[cat] ?? 0,
    }))
    .filter((d) => d.Items > 0);
}

/** A point on the burial trend area chart. */
export interface BurialTrendPoint {
  month: string;
  Burials: number;
}

/** A bar on the monthly revenue chart. */
export interface RevenueTrendPoint {
  month: string;
  Revenue: number;
}

/** Map `monthly_burial_trend()` rows onto the area chart's series keys. */
export function burialTrendSeries(rows: BurialTrendRow[]): BurialTrendPoint[] {
  return rows.map((r) => ({ month: r.label, Burials: r.burials }));
}

/** Map `monthly_revenue_trend()` rows onto the bar chart's series keys. */
export function revenueTrendSeries(rows: RevenueTrendRow[]): RevenueTrendPoint[] {
  return rows.map((r) => ({ month: r.label, Revenue: r.revenue }));
}

/** A bar of the referring-funeral-home chart. */
export interface ReferralBar {
  name: string;
  Interments: number;
  pct: number;
}

/**
 * Build the referral ranking series.
 *
 * A ranking, so a horizontal bar rather than a pie — and with 47 distinct
 * funeral homes a pie is doubly wrong. The server already ordered and capped
 * the rows; this only reshapes them, so the chart cannot disagree with the
 * concentration figure shown beside it.
 */
export function referralSeries(homes: Referral[]): ReferralBar[] {
  return homes.map((h) => ({ name: h.name, Interments: h.n, pct: h.pct }));
}

/**
 * Age bands in the order the histogram presents them.
 *
 * Declared here rather than read off the object's keys: `ageBands` is an
 * unordered record, and sorting it by key would put `0-17` between `18-44` and
 * `45-64` as strings. A distribution read out of order is worse than no chart.
 */
export const AGE_BANDS = ['0-17', '18-44', '45-64', '65-79', '80+'] as const;

/** A bar of the age-at-death distribution. */
export interface AgeBandBar {
  band: string;
  Interments: number;
}

/**
 * Build the age-at-death distribution.
 *
 * Empty bands are kept, unlike the other charts here: a gap in the middle of a
 * distribution is information, and dropping it would silently reshape the
 * curve.
 *
 * @param byBand `ageBands` from the summary RPC; absent keys are zero.
 */
export function ageBandSeries(byBand: Record<string, number>): AgeBandBar[] {
  return AGE_BANDS.map((band) => ({ band, Interments: byBand[band] ?? 0 }));
}

/** A bar of the vendor-spend-by-category chart. */
export interface VendorSpendBar {
  category: string;
  Spend: number;
}

/**
 * Build the vendor spend ranking, largest first.
 *
 * Sorted here because the RPC returns an unordered object; a ranking chart that
 * reorders itself between refetches is unreadable. Categories with no known
 * spend are dropped — only 9 of 47 vendors carry a spend figure, so keeping the
 * rest would render a chart that is mostly empty axis.
 */
export function vendorSpendSeries(
  byCategory: Record<string, number>,
): VendorSpendBar[] {
  return Object.entries(byCategory)
    .filter(([, spend]) => spend > 0)
    .map(([category, Spend]) => ({ category, Spend }))
    .sort((a, b) => b.Spend - a.Spend);
}

// ---------------------------------------------------------------------------
// Sales — the contract ledger
//
// Every series below is *booked sale value* from the paid-in-full register: a
// cash/booking figure, not recognised revenue. The key names say `Sale value`
// so a chart cannot be relabelled by accident on its way to a `dataKey`.
// ---------------------------------------------------------------------------

/** A point on the monthly contracts-written chart. */
export interface ContractTrendPoint {
  month: string;
  Contracts: number;
  'Sale value': number;
}

/** Map `contract_trend()` rows onto the sales chart's series keys. */
export function contractTrendSeries(rows: ContractTrendRow[]): ContractTrendPoint[] {
  return rows.map((r) => ({
    month: r.label,
    Contracts: r.contracts,
    'Sale value': r.sale_value,
  }));
}

/** A bar of the per-cemetery comparison. */
export interface CemeteryBar {
  name: string;
  short: string;
  Contracts: number;
  'Sale value': number;
  avgValue: number;
  preNeedPct: number;
}

/**
 * Shorten a cemetery name for a chart axis.
 *
 * "Detroit Memorial Park East" is 26 characters and the three names share a
 * 22-character prefix, so an axis of full names is both unreadable and
 * uninformative — the distinguishing word is the last one.
 */
function shortCemeteryName(name: string): string {
  const trimmed = name.replace(/^Detroit Memorial Park\s*/i, '');
  return trimmed || name;
}

/**
 * Build the per-cemetery comparison, largest book first.
 *
 * Carries `avgValue` and `preNeedPct` alongside the totals because the totals
 * alone only restate how big each location is. The finding an operator wants is
 * whether a smaller location sells *differently*, and that lives in the average
 * and the pre-need mix.
 */
export function cemeterySalesSeries(rows: CemeterySales[]): CemeteryBar[] {
  return rows
    .map((r) => ({
      name: r.name,
      short: shortCemeteryName(r.name),
      Contracts: r.contracts,
      'Sale value': r.value,
      avgValue: r.avgValue,
      preNeedPct: r.contracts > 0 ? (r.preNeed / r.contracts) * 100 : 0,
    }))
    .sort((a, b) => b['Sale value'] - a['Sale value']);
}

/**
 * How many trailing years the by-year charts show.
 *
 * The ledger's signed dates run back to 1962, because a pre-need contract
 * written decades ago is paid off inside the export window and enters the file
 * then. Those early years are real but they are a lookback tail, not sales
 * activity, and plotting them draws sixty mostly-empty columns.
 */
export const SALES_TREND_YEARS = 8;

/** A column of the sales-by-year chart. */
export interface YearBar {
  year: string;
  'At-need': number;
  'Pre-need': number;
  value: number;
}

/**
 * Build the by-year need-type mix, most recent `SALES_TREND_YEARS` years.
 *
 * Returns the excluded count alongside the series rather than dropping it
 * silently: a chart that quietly starts in 2019 when the data starts in 1962 is
 * a truncation the reader cannot see, so the caption states it.
 */
export function yearSalesSeries(rows: YearSales[]): {
  series: YearBar[];
  omittedContracts: number;
  omittedYears: number;
} {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const shown = sorted.slice(-SALES_TREND_YEARS);
  const omitted = sorted.slice(0, Math.max(0, sorted.length - SALES_TREND_YEARS));

  return {
    series: shown.map((r) => ({
      year: String(r.year),
      'At-need': r.atNeed,
      'Pre-need': r.preNeed,
      value: r.value,
    })),
    omittedContracts: omitted.reduce((sum, r) => sum + r.contracts, 0),
    omittedYears: omitted.length,
  };
}

/** A bar of the product-line ranking. */
export interface ProductBar {
  code: string;
  group: string | null;
  Lines: number;
  'Sale value': number;
}

/**
 * Build the product ranking.
 *
 * The server already ordered and capped these. Codes are passed through
 * untouched — `SRVM` is what the source system records and what DMP staff read,
 * and expanding it into a guessed English phrase would put an invented product
 * name on the dashboard.
 */
export function productSeries(rows: ProductSales[]): ProductBar[] {
  return rows.map((r) => ({
    code: r.code,
    group: r.group,
    Lines: r.lines,
    'Sale value': r.value,
  }));
}

/**
 * Contract-value bands, in ascending order.
 *
 * Declared rather than read off the object's keys for the same reason as
 * `AGE_BANDS`: `valueBands` is an unordered record, and sorting these as
 * strings puts `$10K+` first and `<$500` last — exactly backwards.
 */
export const VALUE_BANDS = [
  '<$500',
  '$500-999',
  '$1K-2.4K',
  '$2.5K-4.9K',
  '$5K-9.9K',
  '$10K+',
] as const;

/** A bar of the contract-value distribution. */
export interface ValueBandBar {
  band: string;
  Contracts: number;
}

/**
 * Build the contract-value distribution.
 *
 * Empty bands are kept, like `ageBandSeries` and unlike the ranking charts: a
 * gap inside a distribution is information, and closing it would reshape the
 * curve the reader is being asked to judge.
 */
export function valueBandSeries(byBand: Record<string, number>): ValueBandBar[] {
  return VALUE_BANDS.map((band) => ({ band, Contracts: byBand[band] ?? 0 }));
}

