/**
 * Validation of the dashboard RPC payloads.
 *
 * The point of parsing at the boundary is that a bad payload fails loudly here
 * instead of becoming a `NaN` on a KPI card. Two failure modes are worth
 * pinning down: Postgres `numeric` may arrive as a string, and `Number('')` /
 * `Number(null)` are both 0 — a coercion that would put a fabricated zero on a
 * financial figure.
 */
import { describe, expect, it } from 'vitest';
import {
  burialTrendSchema,
  contractTrendSchema,
  dashboardSummarySchema,
  dbNumberSchema,
  revenueTrendSchema,
  salesSchema,
  upcomingGrantSchema,
} from './schemas';

/** `dashboard_summary().sales` as it comes back against the loaded ledger. */
const SALES = {
  dataAsOf: '2026-06-30',
  earliestSignedDate: '1962-04-11',

  contracts: 17311,
  lines: 67019,
  value: 43528654.77,
  avgValue: 2514.51,
  linesPerContract: 3.87,

  preNeedContracts: 2007,
  preNeedValue: 6120000,
  preNeedSharePct: 11.6,

  byCemetery: [
    {
      name: 'Detroit Memorial Park West',
      contracts: 10596, value: 28203544.9, avgValue: 2661.72, preNeed: 1200,
    },
  ],
  byYear: [
    { year: 2025, contracts: 2055, value: 6836593.8, preNeed: 240, atNeed: 1815, preNeedValue: 900000 },
  ],
  topProducts: [{ code: 'SRVM', group: 'S', lines: 6793, value: 8410233.12 }],
  distinctProducts: 530,
  topSalespeople: [{ name: 'BERRIEN, CHERYL', contracts: 4210, value: 10200000 }],
  valueBands: { '<$500': 2100, '$1K-2.4K': 5400, '$10K+': 120 },
};

/** A payload matching what `dashboard_summary()` returns against seeded data. */
const SUMMARY = {
  generatedAt: '2026-07-31T12:00:00+00:00',

  // Anchored on the newest interment rather than on today.
  dataAsOf: '2020-12-31',
  burialsLatestMonth: 75,
  burialsPriorMonth: 55,
  burialsTrailing12: 796,
  totalInterments: 796,
  intermentsByYear: { '2020': 796 },

  topFuneralHomes: [
    { name: 'PYE FUNERAL HOME', n: 207, pct: 26 },
    { name: 'JAMES COLE', n: 187, pct: 23.5 },
  ],
  referralTop5Pct: 64.8,
  distinctFuneralHomes: 47,

  topCounselors: [{ name: 'CHERYL BERRIEN', n: 366 }],

  ageBands: { '0-17': 11, '18-44': 93, '45-64': 211, '65-79': 255, '80+': 225 },
  medianAgeAtDeath: 69,

  sectionsInUse: 41,
  topSections: [{ name: '2', n: 226 }],

  capacity: {
    gravesTotal: 795,
    gravesOccupied: 795,
    lotsTotal: 733,
    runwayYears: null,
    runwayReason: 'Only graves with a recorded interment were imported.',
  },

  customerCount: 779,

  sales: SALES,

  vendorCount: 47,
  vendorSpendKnown: 925466,
  vendorSpendByCategory: { 'Burial Vault Supplier': 413186.66 },
  topVendorsBySpend: [
    { name: 'Comerica Bank', category: 'Payment Processing', spend: 251129.57 },
  ],

  burialsThisMonth: 2,
  burialsLastMonth: 1,
  burialsYTD: 9,

  totalContracts: 3,
  totalAR: 4,
  totalDeposits: 12,
  activeContracts: 3,
  contractsValue: 45000,
  arOutstanding: 1200.5,
  unpaidAR: 4,
  overdueAR: 1,
  apOutstanding: 800,
  activeWO: 2,
  totalWO: 5,
  lowStock: 1,
  totalInventory: 6,
  revenue30d: 9000,
  revenuePrior30d: 7500,
  workOrdersByStatus: { pending: 1, in_progress: 2 },
  inventoryByCategory: { casket: 1, urn: 1 },
  upcomingGrants: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Community Preservation Grant',
      source: 'State of Michigan',
      amount: 25000,
      deadline: '2026-08-15',
      status: 'available',
      daysLeft: 15,
    },
  ],
};

describe('dbNumberSchema', () => {
  it('accepts a JSON number', () => {
    expect(dbNumberSchema.parse(1234.56)).toBe(1234.56);
  });

  it('accepts a numeric column serialised as a string', () => {
    expect(dbNumberSchema.parse('1234.56')).toBe(1234.56);
    expect(dbNumberSchema.parse('0')).toBe(0);
    expect(dbNumberSchema.parse('-42')).toBe(-42);
  });

  it('rejects an empty string instead of coercing it to zero', () => {
    expect(dbNumberSchema.safeParse('').success).toBe(false);
    expect(dbNumberSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects null and undefined instead of coercing them to zero', () => {
    expect(dbNumberSchema.safeParse(null).success).toBe(false);
    expect(dbNumberSchema.safeParse(undefined).success).toBe(false);
  });

  it('rejects a value that would become NaN or Infinity', () => {
    expect(dbNumberSchema.safeParse('not a number').success).toBe(false);
    expect(dbNumberSchema.safeParse(Number.NaN).success).toBe(false);
    expect(dbNumberSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });
});

describe('dashboardSummarySchema', () => {
  it('parses a well-formed summary', () => {
    const parsed = dashboardSummarySchema.parse(SUMMARY);
    expect(parsed.burialsYTD).toBe(9);
    expect(parsed.arOutstanding).toBeCloseTo(1200.5);
    expect(parsed.workOrdersByStatus).toEqual({ pending: 1, in_progress: 2 });
    expect(parsed.upcomingGrants).toHaveLength(1);
  });

  it('coerces string-encoded money fields to numbers', () => {
    const parsed = dashboardSummarySchema.parse({
      ...SUMMARY,
      contractsValue: '45000.00',
      arOutstanding: '1200.50',
      revenue30d: '9000',
    });
    expect(parsed.contractsValue).toBe(45000);
    expect(parsed.arOutstanding).toBe(1200.5);
    expect(parsed.revenue30d).toBe(9000);
  });

  it('accepts empty aggregate objects and an empty grant list', () => {
    const parsed = dashboardSummarySchema.parse({
      ...SUMMARY,
      workOrdersByStatus: {},
      inventoryByCategory: {},
      upcomingGrants: [],
    });
    expect(parsed.workOrdersByStatus).toEqual({});
    expect(parsed.upcomingGrants).toEqual([]);
  });

  it('rejects a summary missing a key the KPI cards read', () => {
    const { burialsYTD: _omitted, ...withoutYtd } = SUMMARY;
    expect(dashboardSummarySchema.safeParse(withoutYtd).success).toBe(false);
  });

  it('rejects a null where a number is required, rather than rendering NaN', () => {
    expect(dashboardSummarySchema.safeParse({ ...SUMMARY, revenue30d: null }).success).toBe(false);
  });

  it('rejects a fractional or negative count', () => {
    expect(dashboardSummarySchema.safeParse({ ...SUMMARY, totalWO: 1.5 }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...SUMMARY, totalWO: -1 }).success).toBe(false);
  });

  it('strips unknown keys so the database may grow a KPI first', () => {
    const parsed = dashboardSummarySchema.parse({ ...SUMMARY, futureKpi: 7 });
    expect('futureKpi' in parsed).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(dashboardSummarySchema.safeParse(null).success).toBe(false);
    expect(dashboardSummarySchema.safeParse('{}').success).toBe(false);
  });
});

describe('dashboardSummarySchema — cemetery fields', () => {
  it('allows a null dataAsOf, which is how "nothing loaded" is expressed', () => {
    // Distinct from a date equal to today: the UI shows "no data loaded"
    // rather than a period label, so this must not be coerced.
    expect(dashboardSummarySchema.parse({ ...SUMMARY, dataAsOf: null }).dataAsOf).toBeNull();
  });

  it('allows a null runwayYears while keeping its reason', () => {
    // Runway is not computable from an import that only created occupied
    // graves. The null is the answer, and the reason is what the card renders.
    const parsed = dashboardSummarySchema.parse(SUMMARY);
    expect(parsed.capacity.runwayYears).toBeNull();
    expect(parsed.capacity.runwayReason).toContain('recorded interment');
  });

  it('allows null referral and median-age figures when there is nothing to compute', () => {
    const parsed = dashboardSummarySchema.parse({
      ...SUMMARY,
      referralTop5Pct: null,
      medianAgeAtDeath: null,
    });
    expect(parsed.referralTop5Pct).toBeNull();
    expect(parsed.medianAgeAtDeath).toBeNull();
  });

  it('coerces string-encoded referral percentages and spend', () => {
    const parsed = dashboardSummarySchema.parse({
      ...SUMMARY,
      referralTop5Pct: '64.8',
      medianAgeAtDeath: '69',
      topFuneralHomes: [{ name: 'PYE FUNERAL HOME', n: 207, pct: '26.0' }],
      vendorSpendKnown: '925466.00',
    });
    expect(parsed.referralTop5Pct).toBe(64.8);
    expect(parsed.medianAgeAtDeath).toBe(69);
    expect(parsed.topFuneralHomes[0].pct).toBe(26);
    expect(parsed.vendorSpendKnown).toBe(925466);
  });

  it('rejects a referral row missing its share', () => {
    expect(dashboardSummarySchema.safeParse({
      ...SUMMARY,
      topFuneralHomes: [{ name: 'PYE FUNERAL HOME', n: 207 }],
    }).success).toBe(false);
  });

  it('accepts empty rankings and band maps', () => {
    const parsed = dashboardSummarySchema.parse({
      ...SUMMARY,
      topFuneralHomes: [],
      topCounselors: [],
      topSections: [],
      ageBands: {},
      intermentsByYear: {},
      vendorSpendByCategory: {},
      topVendorsBySpend: [],
    });
    expect(parsed.topFuneralHomes).toEqual([]);
    expect(parsed.ageBands).toEqual({});
  });

  it('allows a vendor with no category', () => {
    const parsed = dashboardSummarySchema.parse({
      ...SUMMARY,
      topVendorsBySpend: [{ name: 'Comerica Bank', category: null, spend: 251129.57 }],
    });
    expect(parsed.topVendorsBySpend[0].category).toBeNull();
  });
});

describe('salesSchema', () => {
  it('parses a well-formed ledger', () => {
    const parsed = salesSchema.parse(SALES);
    expect(parsed.contracts).toBe(17311);
    expect(parsed.value).toBeCloseTo(43528654.77);
    expect(parsed.byCemetery[0].name).toBe('Detroit Memorial Park West');
  });

  it('nulls the three quotients on an empty ledger rather than reporting zero', () => {
    // Each divides by the contract count. Coercing them to 0 would state an
    // average contract value of $0.00 for a database that has no contracts —
    // a fact the data does not support.
    const parsed = salesSchema.parse({
      ...SALES,
      contracts: 0, lines: 0, value: 0,
      avgValue: null, linesPerContract: null, preNeedSharePct: null,
      dataAsOf: null, earliestSignedDate: null,
      byCemetery: [], byYear: [], topProducts: [], topSalespeople: [], valueBands: {},
    });
    expect(parsed.avgValue).toBeNull();
    expect(parsed.linesPerContract).toBeNull();
    expect(parsed.preNeedSharePct).toBeNull();
    expect(parsed.dataAsOf).toBeNull();
  });

  it('coerces string-encoded money and percentages', () => {
    const parsed = salesSchema.parse({
      ...SALES,
      value: '43528654.77',
      avgValue: '2514.51',
      preNeedSharePct: '11.6',
      byCemetery: [{
        name: 'Gracelawn Cemetery', contracts: 2089,
        value: '2533770.41', avgValue: '1212.91', preNeed: 200,
      }],
    });
    expect(parsed.value).toBe(43528654.77);
    expect(parsed.avgValue).toBe(2514.51);
    expect(parsed.byCemetery[0].value).toBe(2533770.41);
  });

  it('keeps its own dataAsOf, separate from the burial register', () => {
    // The interment register ends in 2020 and the ledger runs to 2026. One
    // shared date would mislabel the period under every sales card.
    const parsed = dashboardSummarySchema.parse(SUMMARY);
    expect(parsed.dataAsOf).toBe('2020-12-31');
    expect(parsed.sales.dataAsOf).toBe('2026-06-30');
  });

  it('allows a product line with no group', () => {
    const parsed = salesSchema.parse({
      ...SALES,
      topProducts: [{ code: 'MISC', group: null, lines: 1, value: 5 }],
    });
    expect(parsed.topProducts[0].group).toBeNull();
  });

  it('rejects a cemetery row missing its value', () => {
    expect(salesSchema.safeParse({
      ...SALES,
      byCemetery: [{ name: 'Gracelawn Cemetery', contracts: 2089, avgValue: 1212.91, preNeed: 200 }],
    }).success).toBe(false);
  });

  it('rejects a fractional contract count', () => {
    expect(salesSchema.safeParse({ ...SALES, contracts: 1.5 }).success).toBe(false);
  });

  it('rejects a null where a total is required', () => {
    expect(salesSchema.safeParse({ ...SALES, value: null }).success).toBe(false);
    expect(salesSchema.safeParse({ ...SALES, contracts: null }).success).toBe(false);
  });

  it('rejects a summary with no sales block at all', () => {
    const { sales: _omitted, ...withoutSales } = SUMMARY;
    expect(dashboardSummarySchema.safeParse(withoutSales).success).toBe(false);
  });
});

describe('contractTrendSchema', () => {
  it('parses snake_case rows and coerces a string sale_value', () => {
    const parsed = contractTrendSchema.parse([
      { month_start: '2025-05-01', label: 'May 2025', contracts: 3, sale_value: '7500.50' },
    ]);
    expect(parsed[0].sale_value).toBe(7500.5);
    expect(parsed[0].contracts).toBe(3);
  });

  it('accepts a zero-filled month', () => {
    const parsed = contractTrendSchema.parse([
      { month_start: '2025-06-01', label: 'Jun 2025', contracts: 0, sale_value: 0 },
    ]);
    expect(parsed[0].contracts).toBe(0);
  });

  it('accepts an empty result set', () => {
    expect(contractTrendSchema.parse([])).toEqual([]);
  });

  it('rejects a row missing its sale_value', () => {
    expect(contractTrendSchema.safeParse([
      { month_start: '2025-06-01', label: 'Jun 2025', contracts: 1 },
    ]).success).toBe(false);
  });
});

describe('upcomingGrantSchema', () => {
  const GRANT = SUMMARY.upcomingGrants[0];

  it('allows a null amount, because grants.amount is nullable', () => {
    expect(upcomingGrantSchema.parse({ ...GRANT, amount: null }).amount).toBeNull();
  });

  it('keeps the server-computed daysLeft, including zero', () => {
    expect(upcomingGrantSchema.parse({ ...GRANT, daysLeft: 0 }).daysLeft).toBe(0);
  });

  it('rejects a grant with no deadline', () => {
    expect(upcomingGrantSchema.safeParse({ ...GRANT, deadline: null }).success).toBe(false);
  });
});

describe('trend schemas', () => {
  it('parses snake_case trend rows', () => {
    const parsed = burialTrendSchema.parse([
      { month_start: '2026-06-01', label: 'Jun', burials: 0 },
      { month_start: '2026-07-01', label: 'Jul', burials: 2 },
    ]);
    expect(parsed.map((r) => r.burials)).toEqual([0, 2]);
  });

  it('coerces a string-encoded revenue column', () => {
    const parsed = revenueTrendSchema.parse([
      { month_start: '2026-07-01', label: 'Jul', revenue: '1500.50' },
    ]);
    expect(parsed[0].revenue).toBe(1500.5);
  });

  it('accepts an empty result set', () => {
    expect(burialTrendSchema.parse([])).toEqual([]);
    expect(revenueTrendSchema.parse([])).toEqual([]);
  });

  it('rejects a row missing its label', () => {
    expect(burialTrendSchema.safeParse([{ month_start: '2026-07-01', burials: 1 }]).success)
      .toBe(false);
  });

  it('rejects a non-array payload', () => {
    expect(burialTrendSchema.safeParse({ month_start: '2026-07-01' }).success).toBe(false);
  });
});
