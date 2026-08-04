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
  NamedCount,
  Referral,
  RevenueTrendRow,
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

/** A bar of a generic `{name, n}` ranking (sections, counselors). */
export interface NamedCountBar {
  name: string;
  Interments: number;
}

/**
 * Reshape a server-ranked `{name, n}` list for a bar chart. Order is the
 * server's; re-sorting here would let the two disagree.
 */
export function namedCountSeries(rows: NamedCount[]): NamedCountBar[] {
  return rows.map((r) => ({ name: r.name, Interments: r.n }));
}
