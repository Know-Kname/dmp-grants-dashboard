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

import type { BurialTrendRow, RevenueTrendRow } from './schemas';

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
