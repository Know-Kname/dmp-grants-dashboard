/**
 * Maintenance and service tasks.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { WorkOrder } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fromRows, fetchAll, mutationSideEffects, sb, createdByFields } from './_shared';

// ============================================
// WORK ORDERS
// ============================================

export function useWorkOrders() {
  return useQuery({
    queryKey: queryKeys.workOrders.list(),
    queryFn: () => fetchAll<WorkOrder>('work_orders', 'created_at'),
  });
}

/** The columns the dashboard activity feed renders for a work order. */
export type RecentWorkOrder = Pick<WorkOrder, 'id' | 'title' | 'status' | 'createdAt'>;

/**
 * The newest `limit` work orders, for the dashboard activity feed.
 *
 * The feed used to slice `useWorkOrders()`, i.e. it downloaded the whole table
 * to show five rows. `.limit()` in the database is the point of this hook — do
 * not "simplify" it back to a client-side slice of the full list.
 *
 * @param limit Maximum rows to return.
 */
export function useRecentWorkOrders(limit: number) {
  return useQuery({
    queryKey: queryKeys.workOrders.recent(limit),
    queryFn: async () =>
      fromRows<RecentWorkOrder>(
        await sb(
          supabase.from('work_orders')
            .select('id, title, status, created_at')
            .order('created_at', { ascending: false })
            .limit(limit)
        )
      ),
  });
}

/**
 * Status every newly created work order opens in.
 *
 * `work_orders.status` is NOT NULL with no database default, and the create form
 * has no status field — status is something staff change later, not something
 * they pick up front. Nothing supplied it, so every work-order insert violated
 * the constraint; the old `as Omit<WorkOrder, ...>` cast on the payload hid the
 * omission from the compiler.
 */
const NEW_WORK_ORDER_STATUS = 'pending' satisfies WorkOrder['status'];

export function useCreateWorkOrder(callbacks?: MutationCallbacks<WorkOrder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<CreateInput<WorkOrder>, 'createdBy' | 'status'>) => {
      const row = await sb(
        supabase.from('work_orders')
          .insert({
            ...toSnakeCaseKeys(data),
            status: NEW_WORK_ORDER_STATUS,
            ...(await createdByFields()),
          })
          .select().single()
      );
      return fromRow<WorkOrder>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.workOrders.all, callbacks),
  });
}

export function useUpdateWorkOrder(callbacks?: MutationCallbacks<WorkOrder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<WorkOrder>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('work_orders')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<WorkOrder>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.workOrders.all, callbacks),
  });
}

export function useDeleteWorkOrder(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('work_orders').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.workOrders.all, callbacks),
  });
}
