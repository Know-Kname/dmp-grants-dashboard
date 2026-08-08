/**
 * Deposits, accounts receivable and accounts payable.
 *
 * One module for all three: they share the Financial page and differ only in
 * which table they touch.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow } from '../../lib/writeResult';
import type { Deposit, AccountsReceivable, AccountsPayable } from '../../types';
import { type MutationCallbacks, type CreateInput, fromRow, fetchAll, mutationSideEffects, sb, createdByFields } from './_shared';

// ============================================
// FINANCIAL - DEPOSITS
// ============================================

export function useDeposits() {
  return useQuery({
    queryKey: queryKeys.financial.deposits.list(),
    queryFn: () => fetchAll<Deposit>('deposits', 'created_at'),
  });
}

export function useCreateDeposit(callbacks?: MutationCallbacks<Deposit>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<CreateInput<Deposit>, 'createdBy'>) => {
      const row = await sb(
        supabase.from('deposits')
          .insert({ ...toSnakeCaseKeys(data), ...(await createdByFields()) })
          .select().single()
      );
      return fromRow<Deposit>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.financial.deposits.all, callbacks),
  });
}

// ============================================
// FINANCIAL - ACCOUNTS RECEIVABLE
// ============================================

export function useReceivables() {
  return useQuery({
    queryKey: queryKeys.financial.receivables.list(),
    queryFn: () => fetchAll<AccountsReceivable>('accounts_receivable', 'created_at'),
  });
}

/**
 * Status every newly created invoice opens in.
 *
 * `status` is NOT NULL with no database default on both accounts_receivable and
 * accounts_payable, and both create hooks deliberately omit it from their input
 * so a caller cannot open an invoice already marked paid. Something therefore
 * has to supply it — nothing did, so every receivable and payable insert failed
 * the NOT NULL constraint. (`amountPaid` is omitted safely: it *does* default
 * to 0 in the database.)
 */
const NEW_INVOICE_STATUS = 'pending' satisfies AccountsReceivable['status'];

export function useCreateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<CreateInput<AccountsReceivable>, 'amountPaid' | 'status'>
    ) => {
      const row = await sb(
        supabase.from('accounts_receivable')
          .insert({ ...toSnakeCaseKeys(data), status: NEW_INVOICE_STATUS })
          .select().single()
      );
      return fromRow<AccountsReceivable>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.financial.receivables.all, callbacks),
  });
}

export function useUpdateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; amountPaid?: number; status?: string }) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('accounts_receivable')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<AccountsReceivable>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.financial.receivables.all, callbacks),
  });
}

// ============================================
// FINANCIAL - ACCOUNTS PAYABLE
// ============================================

export function usePayables() {
  return useQuery({
    queryKey: queryKeys.financial.payables.list(),
    queryFn: () => fetchAll<AccountsPayable>('accounts_payable', 'created_at'),
  });
}

export function useCreatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<CreateInput<AccountsPayable>, 'amountPaid' | 'status'>
    ) => {
      const row = await sb(
        supabase.from('accounts_payable')
          .insert({ ...toSnakeCaseKeys(data), status: NEW_INVOICE_STATUS })
          .select().single()
      );
      return fromRow<AccountsPayable>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.financial.payables.all, callbacks),
  });
}

export function useUpdatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; amountPaid?: number; status?: string }) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('accounts_payable')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<AccountsPayable>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.financial.payables.all, callbacks),
  });
}
