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
  dashboardSummarySchema,
  dbNumberSchema,
  revenueTrendSchema,
  upcomingGrantSchema,
} from './schemas';

/** A payload matching what `dashboard_summary()` returns against seeded data. */
const SUMMARY = {
  generatedAt: '2026-07-31T12:00:00+00:00',
  burialsThisMonth: 2,
  burialsLastMonth: 1,
  burialsYTD: 9,
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
