/**
 * Suppliers and service providers.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { Vendor } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fetchAll, mutationSideEffects, sb } from './_shared';

// ============================================
// VENDORS
// ============================================

export function useVendors() {
  return useQuery({
    queryKey: queryKeys.vendors.list(),
    queryFn: () => fetchAll<Vendor>('vendors', 'name', true),
  });
}

export function useCreateVendor(callbacks?: MutationCallbacks<Vendor>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Vendor>) => {
      const row = await sb(
        supabase.from('vendors')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Vendor>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.vendors.all, callbacks),
  });
}

export function useUpdateVendor(callbacks?: MutationCallbacks<Vendor>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Vendor>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('vendors')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Vendor>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.vendors.all, callbacks),
  });
}

export function useDeleteVendor(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('vendors').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.vendors.all, callbacks),
  });
}
