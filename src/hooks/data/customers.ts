/**
 * Contact records and family information.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { Customer } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fetchAll, mutationSideEffects, sb } from './_shared';

// ============================================
// CUSTOMERS
// ============================================

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.list(),
    queryFn: () => fetchAll<Customer>('customers', 'created_at'),
  });
}

export function useCreateCustomer(callbacks?: MutationCallbacks<Customer>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Customer>) => {
      const row = await sb(
        supabase.from('customers')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Customer>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.customers.all, callbacks),
  });
}

export function useUpdateCustomer(callbacks?: MutationCallbacks<Customer>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Customer>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('customers')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Customer>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.customers.all, callbacks),
  });
}

export function useDeleteCustomer(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('customers').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.customers.all, callbacks),
  });
}
