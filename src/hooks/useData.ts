/**
 * React Query hooks for all DMP CMS data modules.
 * All hooks call Supabase directly — there is no Express/API server.
 *
 * Every module follows the same shape: a list query, plus create/update/delete
 * mutations. The shared pieces of that shape live in the HELPERS section below —
 * `fromRow`/`fromRows` for the snake_case → camelCase boundary, and
 * `mutationSideEffects` for the invalidate-then-notify wiring that every
 * mutation repeats.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isUUID, toCamelCaseKeys, toSnakeCaseKeys } from '../lib/utils';
import { queryKeys } from '../lib/query';
import { affectedRow, affectedRows, WriteBlockedError } from '../lib/writeResult';
import { profilesTable, type Profile, type ProfileRow } from '../lib/profiles';
import { toAppRole, type AppRole } from '../lib/permissions';
import type { Database, TablesInsert } from '../types/database';
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

/**
 * What a create hook accepts: the domain model minus the fields the database
 * owns. Hooks that also let the server decide a field narrow it further, e.g.
 * `Omit<CreateInput<WorkOrder>, 'createdBy'>`.
 *
 * `Omit` tolerates keys a given model doesn't have, so this works for models
 * like `Deposit` that have no `updatedAt`.
 */
type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/** What an update hook accepts: any subset of the model, plus the id to target. */
type UpdateInput<T> = Partial<T> & { id: string };

/** Every table name in the public schema, straight from the generated types. */
type TableName = keyof Database['public']['Tables'];

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
// HELPERS
// ============================================

/**
 * Convert one Postgres row into its camelCase domain object.
 *
 * The cast is unavoidable — the generated row types are snake_case and the
 * domain interfaces are camelCase, and no transform can prove that
 * correspondence to the compiler. Keeping it in one named place means the cast
 * is auditable rather than repeated at forty call sites.
 */
function fromRow<T>(row: unknown): T {
  return toCamelCaseKeys(row as Record<string, unknown>) as unknown as T;
}

/** {@link fromRow} for a result set. */
function fromRows<T>(rows: unknown): T[] {
  return (rows as Record<string, unknown>[]).map((row) => fromRow<T>(row));
}

/**
 * Fetch every row of `table`, newest first by default, as domain objects.
 *
 * @param table   Table to read; constrained to real tables by the generated types.
 * @param orderBy Column to sort on.
 * @param ascending Sort direction. Defaults to descending (newest first).
 */
async function fetchAll<T>(
  table: TableName,
  orderBy: string,
  ascending = false
): Promise<T[]> {
  return fromRows<T>(
    await sb(supabase.from(table).select('*').order(orderBy, { ascending }))
  );
}

/**
 * The `onSuccess`/`onError` pair every mutation in this file needs: invalidate
 * the affected query key so the list refetches, then hand off to the caller's
 * callbacks.
 *
 * `onError` is passed straight through. React Query calls it with
 * `(error, variables, context)` and the extra arguments are simply ignored, so
 * the wrapper the call sites used to spell out added nothing.
 *
 * @param invalidate Query key to invalidate — normally the module's `.all`.
 */
function mutationSideEffects<T>(
  queryClient: QueryClient,
  invalidate: readonly unknown[],
  callbacks?: MutationCallbacks<T>
) {
  return {
    onSuccess: (data: T) => {
      queryClient.invalidateQueries({ queryKey: invalidate });
      callbacks?.onSuccess?.(data);
    },
    onError: callbacks?.onError,
  };
}

// ============================================
// WORK ORDERS
// ============================================

export function useWorkOrders() {
  return useQuery({
    queryKey: queryKeys.workOrders.list(),
    queryFn: () => fetchAll<WorkOrder>('work_orders', 'created_at'),
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

// ============================================
// BURIALS
// ============================================

export function useBurials() {
  return useQuery({
    queryKey: queryKeys.burials.list(),
    queryFn: () => fetchAll<Burial>('burials', 'created_at'),
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

// Build contract_items insert rows from camelCase ContractItem input, dropping
// any client-side id (real ids are generated by the DB) and binding contractId.
function itemRows(
  items: ContractItem[] | undefined,
  contractId: string
): TablesInsert<'contract_items'>[] {
  return (items ?? []).map(({ id: _id, ...item }) => ({
    ...toSnakeCaseKeys(item),
    contract_id: contractId,
  }));
}

export function useCreateContract(callbacks?: MutationCallbacks<Contract>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Contract>) => {
      const { items, ...contractData } = data;
      const inserted = await sb(
        supabase.from('contracts')
          .insert(toSnakeCaseKeys(contractData))
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
    ...mutationSideEffects(queryClient, queryKeys.contracts.all, callbacks),
  });
}

export function useUpdateContract(callbacks?: MutationCallbacks<Contract>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items, ...data }: UpdateInput<Contract>) => {
      affectedRows(
        await sb(
          supabase.from('contracts')
            .update(toSnakeCaseKeys(data))
            .eq('id', id).select()
        ),
        'update'
      );

      // When items are supplied, replace the contract's line items wholesale.
      // Nothing references contract_items.id, so a delete-then-insert is safe
      // and keeps the persisted set in sync with what the form submitted.
      if (items !== undefined) {
        // This clear-then-insert needs DELETE on contract_items, which only an
        // admin has. A `staff` user can UPDATE the contract itself, so without
        // this check the delete would quietly remove nothing, the insert would
        // succeed, and the contract would end up with every line item twice.
        //
        // `affectedRows` cannot be used directly here: a contract legitimately
        // may have no items, and then zero deleted rows is the correct outcome.
        // So the count is compared against what is actually there.
        const existing = await sb(
          supabase.from('contract_items').select('id').eq('contract_id', id)
        ) as unknown[];
        if (existing.length > 0) {
          const removed = await sb(
            supabase.from('contract_items').delete().eq('contract_id', id).select('id')
          ) as unknown[];
          if (removed.length !== existing.length) {
            throw new WriteBlockedError(
              'The contract was saved, but its line items could not be replaced — only administrators can remove line items. Ask an administrator to make this change.'
            );
          }
        }
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
    ...mutationSideEffects(queryClient, queryKeys.contracts.all, callbacks),
  });
}

export function useDeleteContract(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('contracts').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.contracts.all, callbacks),
  });
}

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
      return fromRows<PaymentScheduleEntry>(rows);
    },
    enabled: !!contractId,
  });
}

// ============================================
// CEMETERY HIERARCHY
// ============================================

export function useCemeteries() {
  return useQuery({
    queryKey: queryKeys.cemeteries.list(),
    queryFn: () => fetchAll<Cemetery>('cemeteries', 'name', true),
  });
}

export function useCreateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Cemetery>) => {
      const row = await sb(
        supabase.from('cemeteries')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Cemetery>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.cemeteries.all, callbacks),
  });
}

export function useUpdateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Cemetery>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('cemeteries')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Cemetery>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.cemeteries.all, callbacks),
  });
}

export function useDeleteCemetery(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('cemeteries').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.cemeteries.all, callbacks),
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
      return fromRows<Section>(rows);
    },
    enabled: !!cemeteryId,
  });
}

export function useCreateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Section>) => {
      const row = await sb(
        supabase.from('sections')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Section>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.sections.all, callbacks),
  });
}

export function useUpdateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Section>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('sections')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Section>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.sections.all, callbacks),
  });
}

export function useDeleteSection(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('sections').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.sections.all, callbacks),
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
      return fromRows<Lot>(rows);
    },
    enabled: !!sectionId,
  });
}

export function useCreateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Lot>) => {
      const row = await sb(
        supabase.from('lots')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Lot>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.lots.all, callbacks),
  });
}

export function useUpdateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Lot>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('lots')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Lot>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.lots.all, callbacks),
  });
}

export function useDeleteLot(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('lots').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.lots.all, callbacks),
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
      return fromRows<Grave>(rows);
    },
    enabled: !!lotId,
  });
}

export function useCreateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Grave>) => {
      const row = await sb(
        supabase.from('graves')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Grave>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.graves.all, callbacks),
  });
}

export function useUpdateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Grave>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('graves')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Grave>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.graves.all, callbacks),
  });
}

export function useDeleteGrave(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('graves').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.graves.all, callbacks),
  });
}

// ============================================
// USER ACCOUNTS (PROFILES) — ADMIN ONLY
// ============================================

/**
 * `profiles` goes through `profilesTable()` rather than `supabase.from()`
 * because the generated `Database` type does not know the table yet — see the
 * header of `lib/profiles` for how that gets removed.
 */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: toAppRole(row.role),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROFILE_COLUMNS = 'id, email, full_name, role, is_active, created_at, updated_at';

/**
 * Every user account.
 *
 * Returns only the caller's own row for a non-admin — RLS decides, not this
 * hook. `/users` is admin-gated anyway; the narrow result is the backstop.
 */
export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: async () => {
      const rows = await sb(
        profilesTable().select(PROFILE_COLUMNS).order('created_at', { ascending: false })
      );
      return (rows as ProfileRow[]).map(toProfile);
    },
  });
}

/**
 * Change a user's role and/or active flag.
 *
 * Only admins may UPDATE `profiles`; for everyone else the policy filters the
 * row out and the write lands on nothing, so the result goes through
 * `affectedRow` like every other update in this file.
 *
 * There is deliberately no create or delete hook: INSERT and DELETE on
 * `profiles` are closed to the API entirely. Rows appear via the `auth.users`
 * trigger when an admin invites someone from the Supabase dashboard (see
 * docs/06-supabase.md) and disappear when the auth user is deleted.
 */
export function useUpdateProfile(callbacks?: MutationCallbacks<Profile>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, isActive }: { id: string; role?: AppRole; isActive?: boolean }) => {
      const patch: Record<string, unknown> = {};
      if (role !== undefined) patch.role = role;
      if (isActive !== undefined) patch.is_active = isActive;

      const rows = await sb(
        profilesTable().update(patch).eq('id', id).select(PROFILE_COLUMNS)
      );
      return toProfile(affectedRow(rows, 'update') as unknown as ProfileRow);
    },
    ...mutationSideEffects(queryClient, queryKeys.profiles.all, callbacks),
  });
}

// ============================================
// PUBLIC (UNAUTHENTICATED) — MEMORIAL PAGES
// ============================================

export function usePublicBurial(id: string) {
  return useQuery({
    queryKey: queryKeys.burials.memorial(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('burials')
        .select('id, deceased_first_name, deceased_last_name, deceased_middle_name, date_of_birth, date_of_death, burial_date, plot_location, section, lot, grave, memorial_published')
        .eq('id', id)
        .eq('memorial_published', true)
        .single();
      if (error) throw new Error(error.message);
      return fromRow<Burial>(data);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

