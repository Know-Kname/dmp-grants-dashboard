/**
 * React Query hooks for all DMP CMS data modules.
 * All hooks call Supabase directly — there is no Express/API server.
 * Pattern: supabase.from('table') → error check → toCamelCaseKeys → typed return.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isUUID, toCamelCaseKeys, toSnakeCaseKeys } from '../lib/utils';
import { queryKeys } from '../lib/query';
import type {
  WorkOrder,
  Grant,
  InventoryItem,
  Customer,
  Vendor,
  Burial,
  Contract,
  ContractItem,
  Deposit,
  AccountsReceivable,
  AccountsPayable,
  PaymentScheduleEntry,
  Cemetery,
  Section,
  Lot,
  Grave,
} from '../types';

// ============================================
// GENERIC TYPES
// ============================================

interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

// Unwrap a Supabase result: throw on error, throw if no data was returned,
// otherwise return the raw row(s) as `unknown` for the caller to cast.
// Returning `unknown` keeps casts honest (the client is untyped) and lets the
// explicit null check guard against `{ data: null, error: null }` responses
// instead of masking them with a non-null assertion.
async function sb(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<unknown> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) {
    throw new Error('Supabase returned no data');
  }
  return data;
}

/**
 * Resolve the current user's ID for audit columns.
 *
 * Returns `null` when there is no authenticated session. This previously
 * returned the string 'unknown', which was not merely imprecise: `created_by` is
 * a `uuid` column, so Postgres rejected the insert outright with
 * `invalid input syntax for type uuid`. Every create failed for demo and
 * signed-out sessions — the exact cases the fallback was meant to support.
 *
 * The `isUUID` guard keeps that guarantee explicit: nothing that isn't a valid
 * UUID can reach a uuid column through this path.
 *
 * @returns The authenticated user's UUID, or `null` if there is no valid session.
 */
async function uid(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const id = user?.id;
  return id && isUUID(id) ? id : null;
}

/**
 * Build the `created_by` fragment of an insert payload.
 *
 * Spread into the row being inserted. It contributes the column when a user is
 * authenticated and contributes *nothing* otherwise, so the column is left NULL
 * rather than being filled with a placeholder.
 *
 * @returns `{ created_by: <uuid> }`, or `{}` when unauthenticated.
 */
async function createdByFields(): Promise<{ created_by?: string }> {
  const userId = await uid();
  return userId ? { created_by: userId } : {};
}

// ============================================
// WORK ORDERS
// ============================================

export function useWorkOrders() {
  return useQuery({
    queryKey: queryKeys.workOrders.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('work_orders').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as WorkOrder);
    },
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.workOrders.detail(id),
    queryFn: async () => {
      const row = await sb(supabase.from('work_orders').select('*').eq('id', id).single());
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as WorkOrder;
    },
    enabled: !!id,
  });
}

export function useCreateWorkOrder(callbacks?: MutationCallbacks<WorkOrder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
      const row = await sb(
        supabase.from('work_orders')
          .insert({ ...toSnakeCaseKeys(data as Record<string, unknown>), ...(await createdByFields()) })
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as WorkOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateWorkOrder(callbacks?: MutationCallbacks<WorkOrder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WorkOrder> & { id: string }) => {
      const row = await sb(
        supabase.from('work_orders')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as WorkOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteWorkOrder(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_orders').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// GRANTS
// ============================================

export function useGrants() {
  return useQuery({
    queryKey: queryKeys.grants.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('grants').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Grant);
    },
  });
}

export function useGrant(id: string) {
  return useQuery({
    queryKey: queryKeys.grants.detail(id),
    queryFn: async () => {
      const row = await sb(supabase.from('grants').select('*').eq('id', id).single());
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Grant;
    },
    enabled: !!id,
  });
}

export function useCreateGrant(callbacks?: MutationCallbacks<Grant>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Grant, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
      const row = await sb(
        supabase.from('grants')
          .insert({ ...toSnakeCaseKeys(data as Record<string, unknown>), ...(await createdByFields()) })
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Grant;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateGrant(callbacks?: MutationCallbacks<Grant>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Grant> & { id: string }) => {
      const row = await sb(
        supabase.from('grants')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Grant;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteGrant(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grants').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// INVENTORY
// ============================================

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('inventory').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as InventoryItem);
    },
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.detail(id),
    queryFn: async () => {
      const row = await sb(supabase.from('inventory').select('*').eq('id', id).single());
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as InventoryItem;
    },
    enabled: !!id,
  });
}

export function useCreateInventoryItem(callbacks?: MutationCallbacks<InventoryItem>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('inventory')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as InventoryItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateInventoryItem(callbacks?: MutationCallbacks<InventoryItem>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InventoryItem> & { id: string }) => {
      const row = await sb(
        supabase.from('inventory')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as InventoryItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteInventoryItem(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// CUSTOMERS
// ============================================

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('customers').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Customer);
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: async () => {
      const row = await sb(supabase.from('customers').select('*').eq('id', id).single());
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Customer;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer(callbacks?: MutationCallbacks<Customer>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('customers')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Customer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateCustomer(callbacks?: MutationCallbacks<Customer>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Customer> & { id: string }) => {
      const row = await sb(
        supabase.from('customers')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Customer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteCustomer(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// BURIALS
// ============================================

export function useBurials() {
  return useQuery({
    queryKey: queryKeys.burials.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('burials').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Burial);
    },
  });
}

export function useBurial(id: string) {
  return useQuery({
    queryKey: queryKeys.burials.detail(id),
    queryFn: async () => {
      const row = await sb(supabase.from('burials').select('*').eq('id', id).single());
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Burial;
    },
    enabled: !!id,
  });
}

export function useCreateBurial(callbacks?: MutationCallbacks<Burial>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Burial, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('burials')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Burial;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.burials.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateBurial(callbacks?: MutationCallbacks<Burial>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Burial> & { id: string }) => {
      const row = await sb(
        supabase.from('burials')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Burial;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.burials.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteBurial(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('burials').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.burials.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// CONTRACTS
// ============================================

type ContractRow = Record<string, unknown> & { contract_items?: Record<string, unknown>[] };

function mapContract(row: ContractRow): Contract {
  const { contract_items, ...rest } = row;
  return {
    ...toCamelCaseKeys(rest as Record<string, unknown>),
    items: (contract_items ?? []).map(item => toCamelCaseKeys(item as Record<string, unknown>)),
  } as unknown as Contract;
}

export function useContracts() {
  return useQuery({
    queryKey: queryKeys.contracts.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('contracts').select('*, contract_items(*)').order('created_at', { ascending: false })
      );
      return (rows as ContractRow[]).map(mapContract);
    },
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: async () => {
      const row = await sb(
        supabase.from('contracts').select('*, contract_items(*)').eq('id', id).single()
      );
      return mapContract(row as ContractRow);
    },
    enabled: !!id,
  });
}

// Build contract_items insert rows from camelCase ContractItem input, dropping
// any client-side id (real ids are generated by the DB) and binding contractId.
function itemRows(items: ContractItem[] | undefined, contractId: string): Record<string, unknown>[] {
  return (items ?? []).map(({ id: _id, ...item }) => ({
    ...toSnakeCaseKeys(item as Record<string, unknown>),
    contract_id: contractId,
  }));
}

export function useCreateContract(callbacks?: MutationCallbacks<Contract>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { items, ...contractData } = data;
      const inserted = await sb(
        supabase.from('contracts')
          .insert(toSnakeCaseKeys(contractData as Record<string, unknown>))
          .select().single()
      ) as Record<string, unknown>;
      const contractId = inserted.id as string;

      const rows = itemRows(items, contractId);
      if (rows.length > 0) {
        await sb(supabase.from('contract_items').insert(rows).select());
      }

      const row = await sb(
        supabase.from('contracts').select('*, contract_items(*)').eq('id', contractId).single()
      );
      return mapContract(row as ContractRow);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateContract(callbacks?: MutationCallbacks<Contract>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items, ...data }: Partial<Contract> & { id: string }) => {
      await sb(
        supabase.from('contracts')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );

      // When items are supplied, replace the contract's line items wholesale.
      // Nothing references contract_items.id, so a delete-then-insert is safe
      // and keeps the persisted set in sync with what the form submitted.
      if (items !== undefined) {
        const { error: delError } = await supabase.from('contract_items').delete().eq('contract_id', id);
        if (delError) throw new Error(delError.message);
        const rows = itemRows(items, id);
        if (rows.length > 0) {
          await sb(supabase.from('contract_items').insert(rows).select());
        }
      }

      const row = await sb(
        supabase.from('contracts').select('*, contract_items(*)').eq('id', id).single()
      );
      return mapContract(row as ContractRow);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteContract(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// FINANCIAL - DEPOSITS
// ============================================

export function useDeposits() {
  return useQuery({
    queryKey: queryKeys.financial.deposits.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('deposits').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Deposit);
    },
  });
}

export function useCreateDeposit(callbacks?: MutationCallbacks<Deposit>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Deposit, 'id' | 'createdAt' | 'createdBy'>) => {
      const row = await sb(
        supabase.from('deposits')
          .insert({ ...toSnakeCaseKeys(data as Record<string, unknown>), ...(await createdByFields()) })
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Deposit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.deposits.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// FINANCIAL - ACCOUNTS RECEIVABLE
// ============================================

export function useReceivables() {
  return useQuery({
    queryKey: queryKeys.financial.receivables.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('accounts_receivable').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as AccountsReceivable);
    },
  });
}

export function useCreateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<AccountsReceivable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'>
    ) => {
      const row = await sb(
        supabase.from('accounts_receivable')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as AccountsReceivable;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.receivables.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; amountPaid?: number; status?: string }) => {
      const row = await sb(
        supabase.from('accounts_receivable')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as AccountsReceivable;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.receivables.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// FINANCIAL - ACCOUNTS PAYABLE
// ============================================

export function usePayables() {
  return useQuery({
    queryKey: queryKeys.financial.payables.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('accounts_payable').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as AccountsPayable);
    },
  });
}

export function useCreatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<AccountsPayable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'>
    ) => {
      const row = await sb(
        supabase.from('accounts_payable')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as AccountsPayable;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.payables.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; amountPaid?: number; status?: string }) => {
      const row = await sb(
        supabase.from('accounts_payable')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as AccountsPayable;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.payables.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// VENDORS
// ============================================

export function useVendors() {
  return useQuery({
    queryKey: queryKeys.vendors.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('vendors').select('*').order('name', { ascending: true })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Vendor);
    },
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: async () => {
      const row = await sb(supabase.from('vendors').select('*').eq('id', id).single());
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Vendor;
    },
    enabled: !!id,
  });
}

export function useCreateVendor(callbacks?: MutationCallbacks<Vendor>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('vendors')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Vendor;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateVendor(callbacks?: MutationCallbacks<Vendor>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Vendor> & { id: string }) => {
      const row = await sb(
        supabase.from('vendors')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Vendor;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteVendor(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// PAYMENT SCHEDULE
// ============================================

export function usePaymentSchedule(contractId: string) {
  return useQuery({
    queryKey: queryKeys.paymentSchedule.byContract(contractId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('payment_schedule').select('*')
          .eq('contract_id', contractId)
          .order('due_date', { ascending: true })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as PaymentScheduleEntry);
    },
    enabled: !!contractId,
  });
}

export function useCreatePaymentScheduleEntry(callbacks?: MutationCallbacks<PaymentScheduleEntry>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<PaymentScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('payment_schedule')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as PaymentScheduleEntry;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSchedule.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdatePaymentScheduleEntry(callbacks?: MutationCallbacks<PaymentScheduleEntry>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PaymentScheduleEntry> & { id: string }) => {
      const row = await sb(
        supabase.from('payment_schedule')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as PaymentScheduleEntry;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSchedule.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// CEMETERY HIERARCHY
// ============================================

export function useCemeteries() {
  return useQuery({
    queryKey: queryKeys.cemeteries.list(),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('cemeteries').select('*').order('name', { ascending: true })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Cemetery);
    },
  });
}

export function useCreateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Cemetery, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('cemeteries')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Cemetery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cemeteries.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Cemetery> & { id: string }) => {
      const row = await sb(
        supabase.from('cemeteries')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Cemetery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cemeteries.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteCemetery(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cemeteries').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cemeteries.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useSections(cemeteryId: string) {
  return useQuery({
    queryKey: queryKeys.sections.byCemetery(cemeteryId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('sections').select('*')
          .eq('cemetery_id', cemeteryId)
          .order('name', { ascending: true })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Section);
    },
    enabled: !!cemeteryId,
  });
}

export function useCreateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Section, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('sections')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Section;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Section> & { id: string }) => {
      const row = await sb(
        supabase.from('sections')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Section;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteSection(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sections').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useLots(sectionId: string) {
  return useQuery({
    queryKey: queryKeys.lots.bySection(sectionId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('lots').select('*')
          .eq('section_id', sectionId)
          .order('lot_number', { ascending: true })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Lot);
    },
    enabled: !!sectionId,
  });
}

export function useCreateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('lots')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Lot;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Lot> & { id: string }) => {
      const row = await sb(
        supabase.from('lots')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Lot;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteLot(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lots').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useGraves(lotId: string) {
  return useQuery({
    queryKey: queryKeys.graves.byLot(lotId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('graves').select('*')
          .eq('lot_id', lotId)
          .order('grave_number', { ascending: true })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Grave);
    },
    enabled: !!lotId,
  });
}

export function useCreateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Grave, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('graves')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Grave;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graves.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Grave> & { id: string }) => {
      const row = await sb(
        supabase.from('graves')
          .update(toSnakeCaseKeys(data as Record<string, unknown>))
          .eq('id', id).select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Grave;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graves.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteGrave(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('graves').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graves.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// PUBLIC (UNAUTHENTICATED) — MEMORIAL PAGES
// ============================================

export function usePublicBurial(id: string) {
  return useQuery({
    queryKey: ['burials', 'memorial', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('burials')
        .select('id, deceased_first_name, deceased_last_name, deceased_middle_name, date_of_birth, date_of_death, burial_date, plot_location, section, lot, grave, memorial_published')
        .eq('id', id)
        .eq('memorial_published', true)
        .single();
      if (error) throw new Error(error.message);
      return toCamelCaseKeys(data) as unknown as Burial;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

