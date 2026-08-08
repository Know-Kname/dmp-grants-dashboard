/**
 * Interment records, plot locations and permits.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { Burial } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fromRows, fetchAll, mutationSideEffects, sb } from './_shared';

// ============================================
// BURIALS
// ============================================

export function useBurials() {
  return useQuery({
    queryKey: queryKeys.burials.list(),
    queryFn: () => fetchAll<Burial>('burials', 'created_at'),
  });
}

/** The columns the dashboard activity feed renders for a burial. */
export type RecentBurial = Pick<
  Burial,
  'id' | 'deceasedFirstName' | 'deceasedLastName' | 'plotLocation' | 'burialDate'
>;

/**
 * The most recently recorded `limit` burials, for the dashboard activity feed.
 * Bounded in the database for the same reason as {@link useRecentWorkOrders}.
 *
 * @param limit Maximum rows to return.
 */
export function useRecentBurials(limit: number) {
  return useQuery({
    queryKey: queryKeys.burials.recent(limit),
    queryFn: async () =>
      fromRows<RecentBurial>(
        await sb(
          supabase.from('burials')
            .select('id, deceased_first_name, deceased_last_name, plot_location, burial_date')
            .order('created_at', { ascending: false })
            .limit(limit)
        )
      ),
  });
}

export function useCreateBurial(callbacks?: MutationCallbacks<Burial>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Burial>) => {
      const row = await sb(
        supabase.from('burials')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Burial>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.burials.all, callbacks),
  });
}

export function useUpdateBurial(callbacks?: MutationCallbacks<Burial>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Burial>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('burials')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Burial>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.burials.all, callbacks),
  });
}

export function useDeleteBurial(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('burials').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.burials.all, callbacks),
  });
}
