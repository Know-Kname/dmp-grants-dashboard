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
  AGE_BANDS,
  INVENTORY_CATEGORIES,
  SALES_TREND_YEARS,
  VALUE_BANDS,
  ageBandSeries,
  cemeterySalesSeries,
  contractTrendSeries,
  modulesLoaded,
  burialTrendSeries,
  formatMonthYear,
  inventoryCategoryData,
  periodLabel,
  productSeries,
  referralSeries,
  revenueTrendSeries,
  valueBandSeries,
  vendorSpendSeries,
  workOrderChartData,
  yearSalesSeries,
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

describe('formatMonthYear', () => {
  it('formats an ISO date as Mon YYYY', () => {
    expect(formatMonthYear('2020-12-31')).toBe('Dec 2020');
    expect(formatMonthYear('2020-01-03')).toBe('Jan 2020');
  });

  it('does not shift the month in negative UTC offsets', () => {
    // `new Date('2020-12-31')` is UTC midnight, which is Dec 30 anywhere west
    // of Greenwich. Parsing the string by hand is what keeps the stated period
    // correct for a Detroit user.
    expect(formatMonthYear('2020-12-01')).toBe('Dec 2020');
    expect(formatMonthYear('2020-03-01')).toBe('Mar 2020');
  });

  it('returns null for no date and for an unparseable one', () => {
    expect(formatMonthYear(null)).toBeNull();
    expect(formatMonthYear('not-a-date')).toBeNull();
    expect(formatMonthYear('2020-13-01')).toBeNull();
  });
});

describe('periodLabel', () => {
  it('states the window and where it ends', () => {
    expect(periodLabel('2020-12-31', 12)).toBe('12 months to Dec 2020');
    expect(periodLabel('2020-12-31', 6)).toBe('6 months to Dec 2020');
  });

  it('says so plainly when nothing is loaded', () => {
    expect(periodLabel(null, 12)).toBe('no data loaded');
  });
});

describe('ageBandSeries', () => {
  it('presents bands in ascending age, not object key order', () => {
    // Sorting these as strings would put '0-17' between '18-44' and '45-64'.
    const series = ageBandSeries({ '80+': 225, '0-17': 11, '45-64': 211 });
    expect(series.map((b) => b.band)).toEqual([...AGE_BANDS]);
  });

  it('keeps empty bands, because a gap in a distribution is information', () => {
    const series = ageBandSeries({ '0-17': 11 });
    expect(series).toHaveLength(AGE_BANDS.length);
    expect(series.find((b) => b.band === '18-44')?.Interments).toBe(0);
  });

  it('renders every band as zero for an empty map', () => {
    expect(ageBandSeries({}).every((b) => b.Interments === 0)).toBe(true);
  });
});

describe('referralSeries', () => {
  it('preserves the server ranking and carries the share through', () => {
    const series = referralSeries([
      { name: 'PYE FUNERAL HOME', n: 207, pct: 26 },
      { name: 'JAMES COLE', n: 187, pct: 23.5 },
    ]);
    expect(series).toEqual([
      { name: 'PYE FUNERAL HOME', Interments: 207, pct: 26 },
      { name: 'JAMES COLE', Interments: 187, pct: 23.5 },
    ]);
  });

  it('handles no referral data', () => {
    expect(referralSeries([])).toEqual([]);
  });
});

describe('vendorSpendSeries', () => {
  it('orders categories by spend, largest first', () => {
    const series = vendorSpendSeries({ Fuel: 51215.69, Vaults: 413186.66, Card: 251129.57 });
    expect(series.map((v) => v.category)).toEqual(['Vaults', 'Card', 'Fuel']);
  });

  it('drops categories with no known spend rather than drawing empty axis', () => {
    // Only 9 of 47 vendors carry a spend figure; keeping the rest would render
    // a chart that is mostly blank.
    expect(vendorSpendSeries({ Fuel: 100, Unknown: 0 }).map((v) => v.category))
      .toEqual(['Fuel']);
  });

  it('handles an empty map', () => {
    expect(vendorSpendSeries({})).toEqual([]);
  });
});


describe('contractTrendSeries', () => {
  it('maps rows onto the sales chart keys, preserving order', () => {
    expect(contractTrendSeries([
      { month_start: '2025-05-01', label: 'May 2025', contracts: 3, sale_value: 7500 },
      { month_start: '2025-06-01', label: 'Jun 2025', contracts: 0, sale_value: 0 },
    ])).toEqual([
      { month: 'May 2025', Contracts: 3, 'Sale value': 7500 },
      { month: 'Jun 2025', Contracts: 0, 'Sale value': 0 },
    ]);
  });

  it('keeps zero-filled months rather than closing the gap', () => {
    // Recharts draws a straight line through a missing point, which would
    // invent sales in a month that had none.
    const rows = [
      { month_start: '2025-04-01', label: 'Apr 2025', contracts: 0, sale_value: 0 },
      { month_start: '2025-05-01', label: 'May 2025', contracts: 0, sale_value: 0 },
      { month_start: '2025-06-01', label: 'Jun 2025', contracts: 2, sale_value: 900 },
    ];
    expect(contractTrendSeries(rows)).toHaveLength(3);
  });

  it('handles an empty ledger', () => {
    expect(contractTrendSeries([])).toEqual([]);
  });
});

describe('cemeterySalesSeries', () => {
  const ROWS = [
    { name: 'Gracelawn Cemetery', contracts: 2089, value: 2533770.41, avgValue: 1212.91, preNeed: 200 },
    { name: 'Detroit Memorial Park West', contracts: 10596, value: 28203544.9, avgValue: 2661.72, preNeed: 1200 },
    { name: 'Detroit Memorial Park East', contracts: 4626, value: 12791339.46, avgValue: 2765.1, preNeed: 607 },
  ];

  it('orders by sale value, largest book first', () => {
    expect(cemeterySalesSeries(ROWS).map((c) => c.short))
      .toEqual(['West', 'East', 'Gracelawn Cemetery']);
  });

  it('strips the shared prefix so the axis shows the distinguishing word', () => {
    // All three names share 'Detroit Memorial Park', so a full-name axis is
    // 26 characters of which 22 are identical.
    const series = cemeterySalesSeries(ROWS);
    expect(series[0].short).toBe('West');
    expect(series[0].name).toBe('Detroit Memorial Park West');
  });

  it('leaves a name without the prefix alone', () => {
    expect(cemeterySalesSeries([
      { name: 'Gracelawn Cemetery', contracts: 1, value: 1, avgValue: 1, preNeed: 0 },
    ])[0].short).toBe('Gracelawn Cemetery');
  });

  it('derives the pre-need share per cemetery', () => {
    const west = cemeterySalesSeries(ROWS).find((c) => c.short === 'West');
    expect(west?.preNeedPct).toBeCloseTo((1200 / 10596) * 100, 5);
  });

  it('reports a zero pre-need share rather than dividing by zero', () => {
    const series = cemeterySalesSeries([
      { name: 'Empty Cemetery', contracts: 0, value: 0, avgValue: 0, preNeed: 0 },
    ]);
    expect(series[0].preNeedPct).toBe(0);
  });

  it('does not mutate the array it was given', () => {
    const input = [...ROWS];
    cemeterySalesSeries(input);
    expect(input[0].name).toBe('Gracelawn Cemetery');
  });
});

describe('yearSalesSeries', () => {
  const year = (y: number, contracts: number) => ({
    year: y, contracts, value: contracts * 1000, preNeed: 1, atNeed: contracts - 1,
    preNeedValue: 1000,
  });

  it('shows only the trailing window, ascending', () => {
    const rows = Array.from({ length: 12 }, (_, i) => year(2015 + i, 10));
    const { series } = yearSalesSeries(rows);
    expect(series).toHaveLength(SALES_TREND_YEARS);
    expect(series[0].year).toBe('2019');
    expect(series[series.length - 1].year).toBe('2026');
  });

  it('reports what it truncated instead of hiding it', () => {
    // The ledger reaches back to 1962 because a pre-need contract written then
    // was paid off inside the export window. Silently starting the chart in
    // 2019 would be a truncation the reader cannot see.
    const rows = [year(1962, 1), year(1985, 2), ...Array.from({ length: 8 }, (_, i) => year(2019 + i, 10))];
    const { omittedContracts, omittedYears } = yearSalesSeries(rows);
    expect(omittedYears).toBe(2);
    expect(omittedContracts).toBe(3);
  });

  it('omits nothing when the ledger is short', () => {
    const { series, omittedContracts, omittedYears } = yearSalesSeries([year(2025, 4)]);
    expect(series).toHaveLength(1);
    expect(omittedContracts).toBe(0);
    expect(omittedYears).toBe(0);
  });

  it('sorts by year even when the server order is not relied upon', () => {
    const { series } = yearSalesSeries([year(2026, 1), year(2024, 1), year(2025, 1)]);
    expect(series.map((s) => s.year)).toEqual(['2024', '2025', '2026']);
  });

  it('splits the columns by need type', () => {
    const { series } = yearSalesSeries([
      { year: 2025, contracts: 10, value: 5000, preNeed: 3, atNeed: 7, preNeedValue: 1500 },
    ]);
    expect(series[0]).toEqual({ year: '2025', 'At-need': 7, 'Pre-need': 3, value: 5000 });
  });

  it('handles an empty ledger', () => {
    expect(yearSalesSeries([])).toEqual({ series: [], omittedContracts: 0, omittedYears: 0 });
  });
});

describe('productSeries', () => {
  it('passes the source codes through untouched', () => {
    // SRVM is what CemSites records and what DMP staff read. The export defines
    // no expansion, so inventing one would put a made-up product on the page.
    expect(productSeries([
      { code: 'SRVM', group: 'S', lines: 6793, value: 15360 },
    ])).toEqual([
      { code: 'SRVM', group: 'S', Lines: 6793, 'Sale value': 15360 },
    ]);
  });

  it('preserves the server ranking rather than re-sorting', () => {
    const series = productSeries([
      { code: 'SRVM', group: 'S', lines: 1, value: 900 },
      { code: 'CARE', group: 'R', lines: 9, value: 100 },
    ]);
    expect(series.map((p) => p.code)).toEqual(['SRVM', 'CARE']);
  });

  it('allows a line with no product group', () => {
    expect(productSeries([{ code: 'MISC', group: null, lines: 1, value: 5 }])[0].group)
      .toBeNull();
  });

  it('handles no product data', () => {
    expect(productSeries([])).toEqual([]);
  });
});

describe('valueBandSeries', () => {
  it('presents bands in ascending value, not object key order', () => {
    // Sorted as strings, '$10K+' leads and '<$500' trails — exactly backwards.
    const series = valueBandSeries({ '$10K+': 12, '<$500': 900, '$1K-2.4K': 400 });
    expect(series.map((b) => b.band)).toEqual([...VALUE_BANDS]);
  });

  it('keeps empty bands, because a gap in a distribution is information', () => {
    const series = valueBandSeries({ '<$500': 5 });
    expect(series).toHaveLength(VALUE_BANDS.length);
    expect(series.find((b) => b.band === '$5K-9.9K')?.Contracts).toBe(0);
  });

  it('renders every band as zero for an empty ledger', () => {
    expect(valueBandSeries({}).every((b) => b.Contracts === 0)).toBe(true);
  });

  it('ignores a band the client does not render', () => {
    const series = valueBandSeries({ '<$500': 3, '$1M+': 99 });
    expect(series).toHaveLength(VALUE_BANDS.length);
    expect(series.some((b) => b.band === '$1M+')).toBe(false);
  });
});

describe('modulesLoaded', () => {
  const EMPTY = {
    totalContracts: 0, totalAR: 0, totalDeposits: 0, totalWO: 0, totalInventory: 0,
  };

  it('reports every module as unloaded when no table has rows', () => {
    expect(modulesLoaded(EMPTY)).toEqual({
      contracts: false, receivables: false, deposits: false,
      workOrders: false, inventory: false,
    });
  });

  it('counts receivables as loaded when every invoice is settled', () => {
    // The regression this function exists for. Gating on `unpaidAR` reported a
    // full AR table as "not loaded" the moment the business collected
    // everything — i.e. exactly when it was doing well.
    expect(modulesLoaded({ ...EMPTY, totalAR: 120 }).receivables).toBe(true);
  });

  it('counts deposits as loaded when the ledger predates the 30-day window', () => {
    // Every DMP dataset so far is 2020, so `revenue30d` would be 0 for a
    // ledger of thousands of rows and the card would read as a failed import.
    expect(modulesLoaded({ ...EMPTY, totalDeposits: 4200 }).deposits).toBe(true);
  });

  it('counts contracts as loaded when none are still active', () => {
    expect(modulesLoaded({ ...EMPTY, totalContracts: 11720 }).contracts).toBe(true);
  });

  it('keeps the modules independent', () => {
    const one = modulesLoaded({ ...EMPTY, totalInventory: 6 });
    expect(one.inventory).toBe(true);
    expect(one.contracts).toBe(false);
    expect(one.receivables).toBe(false);
  });
});
