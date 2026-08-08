/**
 * Caskets, urns, vaults, markers and supplies.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { InventoryItem } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fetchAll, mutationSideEffects, sb } from './_shared';

// ============================================
// INVENTORY
// ============================================

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory.list(),
    queryFn: () => fetchAll<InventoryItem>('inventory', 'created_at'),
  });
}

export function useCreateInventoryItem(callbacks?: MutationCallbacks<InventoryItem>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<InventoryItem>) => {
      const row = await sb(
        supabase.from('inventory')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<InventoryItem>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.inventory.all, callbacks),
  });
}

export function useUpdateInventoryItem(callbacks?: MutationCallbacks<InventoryItem>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<InventoryItem>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('inventory')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<InventoryItem>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.inventory.all, callbacks),
  });
}

export function useDeleteInventoryItem(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('inventory').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.inventory.all, callbacks),
  });
}
