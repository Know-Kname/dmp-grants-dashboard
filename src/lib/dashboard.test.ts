/**
 * The dashboard's chart-shape rules.
 *
 * These transforms replaced `useMemo`s that reduced whole tables in the
 * browser. The aggregation moved to Postgres; the presentation rules did not,
 * and they are exactly the kind of thing that regresses without anyone
 * noticing — a zero slice that should have vanished, a category order that
 * quietly follows object key order instead of the declared one.
 */
import { describe, expect, it } from 'vitest';
import {
  INVENTORY_CATEGORIES,
  burialTrendSeries,
  inventoryCategoryData,
  revenueTrendSeries,
  workOrderChartData,
  type WorkOrderStatusColors,
} from './dashboard';

const COLORS: WorkOrderStatusColors = {
  pending: '#f59e0b',
  in_progress: '#0ea5e9',
  completed: '#22c55e',
  cancelled: '#94a3b8',
  empty: '#94a3b8',
};

describe('workOrderChartData', () => {
  it('keeps only statuses with rows, in donut order', () => {
    expect(workOrderChartData({ completed: 3, pending: 1 }, COLORS)).toEqual([
      { name: 'Pending', value: 1, color: COLORS.pending },
      { name: 'Completed', value: 3, color: COLORS.completed },
    ]);
  });

  it('treats an absent status as zero rather than missing data', () => {
    const data = workOrderChartData({ in_progress: 2 }, COLORS);
    expect(data).toEqual([{ name: 'In Progress', value: 2, color: COLORS.in_progress }]);
  });

  it('drops a status that is explicitly zero', () => {
    const data = workOrderChartData({ pending: 0, cancelled: 4 }, COLORS);
    expect(data.map((d) => d.name)).toEqual(['Cancelled']);
  });

  it('falls back to a single placeholder slice when everything is zero', () => {
    expect(workOrderChartData({}, COLORS)).toEqual([
      { name: 'No Data', value: 1, color: COLORS.empty },
    ]);
    expect(workOrderChartData({ pending: 0, completed: 0 }, COLORS)).toEqual([
      { name: 'No Data', value: 1, color: COLORS.empty },
    ]);
  });

  it('maps every known status to its own colour', () => {
    const data = workOrderChartData(
      { pending: 1, in_progress: 1, completed: 1, cancelled: 1 },
      COLORS,
    );
    expect(data).toEqual([
      { name: 'Pending', value: 1, color: COLORS.pending },
      { name: 'In Progress', value: 1, color: COLORS.in_progress },
      { name: 'Completed', value: 1, color: COLORS.completed },
      { name: 'Cancelled', value: 1, color: COLORS.cancelled },
    ]);
  });

  it('ignores a status the client does not render', () => {
    const data = workOrderChartData({ pending: 1, on_hold: 9 }, COLORS);
    expect(data.map((d) => d.name)).toEqual(['Pending']);
  });
});

describe('inventoryCategoryData', () => {
  it('uses the declared category order, not the object key order', () => {
    const data = inventoryCategoryData({ other: 1, casket: 2, urn: 3 });
    expect(data.map((d) => d.category)).toEqual(['Casket', 'Urn', 'Other']);
  });

  it('capitalises the label and drops empty categories', () => {
    expect(inventoryCategoryData({ vault: 4 })).toEqual([{ category: 'Vault', Items: 4 }]);
    expect(inventoryCategoryData({ vault: 0 })).toEqual([]);
  });

  it('returns an empty series when there is no inventory at all', () => {
    expect(inventoryCategoryData({})).toEqual([]);
  });

  it('covers every category the chart declares', () => {
    const full = Object.fromEntries(INVENTORY_CATEGORIES.map((c, i) => [c, i + 1]));
    expect(inventoryCategoryData(full).map((d) => d.category)).toEqual([
      'Casket', 'Urn', 'Vault', 'Marker', 'Supplies', 'Other',
    ]);
  });

  it('ignores a category the client does not render', () => {
    expect(inventoryCategoryData({ casket: 1, headstone: 7 })).toEqual([
      { category: 'Casket', Items: 1 },
    ]);
  });
});

describe('trend series', () => {
  it('maps burial rows onto the area chart keys, preserving order', () => {
    expect(burialTrendSeries([
      { month_start: '2026-05-01', label: 'May', burials: 2 },
      { month_start: '2026-06-01', label: 'Jun', burials: 0 },
    ])).toEqual([
      { month: 'May', Burials: 2 },
      { month: 'Jun', Burials: 0 },
    ]);
  });

  it('maps revenue rows onto the bar chart keys, preserving order', () => {
    expect(revenueTrendSeries([
      { month_start: '2026-05-01', label: 'May', revenue: 1500.5 },
      { month_start: '2026-06-01', label: 'Jun', revenue: 0 },
    ])).toEqual([
      { month: 'May', Revenue: 1500.5 },
      { month: 'Jun', Revenue: 0 },
    ]);
  });

  it('keeps zero-filled months rather than collapsing the gap', () => {
    const rows = [
      { month_start: '2026-04-01', label: 'Apr', burials: 0 },
      { month_start: '2026-05-01', label: 'May', burials: 0 },
      { month_start: '2026-06-01', label: 'Jun', burials: 1 },
    ];
    expect(burialTrendSeries(rows)).toHaveLength(3);
  });

  it('returns an empty series for an empty result set', () => {
    expect(burialTrendSeries([])).toEqual([]);
    expect(revenueTrendSeries([])).toEqual([]);
  });
});
