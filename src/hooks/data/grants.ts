/**
 * Funding opportunities and veteran benefits.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { Grant } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fetchAll, mutationSideEffects, sb, createdByFields } from './_shared';

// ============================================
// GRANTS
// ============================================

export function useGrants() {
  return useQuery({
    queryKey: queryKeys.grants.list(),
    queryFn: () => fetchAll<Grant>('grants', 'created_at'),
  });
}

export function useCreateGrant(callbacks?: MutationCallbacks<Grant>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<CreateInput<Grant>, 'createdBy'>) => {
      const row = await sb(
        supabase.from('grants')
          .insert({ ...toSnakeCaseKeys(data), ...(await createdByFields()) })
          .select().single()
      );
      return fromRow<Grant>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.grants.all, callbacks),
  });
}

export function useUpdateGrant(callbacks?: MutationCallbacks<Grant>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Grant>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('grants')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Grant>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.grants.all, callbacks),
  });
}

export function useDeleteGrant(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('grants').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.grants.all, callbacks),
  });
}
