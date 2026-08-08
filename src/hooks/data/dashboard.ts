/**
 * Server-side dashboard aggregates.
 *
 * These read RPCs rather than tables: one call replaces seven table scans, and
 * the result is validated against a schema because an RPC signature can drift
 * without the client noticing.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/query';
import { burialTrendSchema, dashboardSummarySchema, revenueTrendSchema } from '../../lib/schemas';
import { sb } from './_shared';

// ============================================
// DASHBOARD AGGREGATES
// ============================================

/**
 * Every dashboard KPI, in one round trip.
 *
 * This replaces seven whole-table queries the Dashboard used to reduce in the
 * browser. That path was unbounded, and PostgREST caps a response at ~1000 rows
 * *with no truncation signal* — past that the KPIs did not error, they quietly
 * went wrong, dropping the oldest rows first.
 *
 * The RPC returns a single `jsonb` object with camelCase keys (it builds them in
 * SQL), so `toCamelCaseKeys` does not apply here; what does apply is validation,
 * because a jsonb blob off the network is `unknown`. `dashboardSummarySchema`
 * parses it once, at the edge, and coerces the numeric fields explicitly.
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: async () => dashboardSummarySchema.parse(await sb(supabase.rpc('dashboard_summary'))),
  });
}

/**
 * Interments per month, zero-filled and ordered ascending by the database.
 *
 * Deliberately separate from {@link useDashboardSummary}: the 6M/12M/24M control
 * changes only this range, and bundling the trends into the summary would
 * refetch every KPI on each toggle.
 *
 * @param months How many months back to return, inclusive of the current one.
 */
export function useBurialTrend(months: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.burialTrend(months),
    queryFn: async () =>
      burialTrendSchema.parse(await sb(supabase.rpc('monthly_burial_trend', { p_months: months }))),
  });
}

/**
 * Deposit totals per month, zero-filled and ordered ascending by the database.
 * Separate from the summary for the same reason as {@link useBurialTrend}.
 *
 * @param months How many months back to return, inclusive of the current one.
 */
export function useRevenueTrend(months: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.revenueTrend(months),
    queryFn: async () =>
      revenueTrendSchema.parse(await sb(supabase.rpc('monthly_revenue_trend', { p_months: months }))),
  });
}
