/**
 * Shared plumbing for the data hooks.
 *
 * Split out of the single 1,258-line `useData.ts` so each domain could live
 * in its own file. These pieces are what every module needs: the
 * snake_case → camelCase boundary, the Supabase result unwrapper, the
 * audit-column helpers, and the invalidate-then-notify wiring that every
 * mutation repeats.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { isUUID, toCamelCaseKeys } from '../../lib/utils';
import type { Database } from '../../types/database';

// ============================================
// GENERIC TYPES
// ============================================

export interface MutationCallbacks<T> {
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
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/** What an update hook accepts: any subset of the model, plus the id to target. */
export type UpdateInput<T> = Partial<T> & { id: string };

/** Every table name in the public schema, straight from the generated types. */
export type TableName = keyof Database['public']['Tables'];

// Unwrap a Supabase result: throw on error, throw if no data was returned,
// otherwise return the raw row(s) as `unknown` for the caller to cast.
// Returning `unknown` keeps casts honest (the client is untyped) and lets the
// explicit null check guard against `{ data: null, error: null }` responses
// instead of masking them with a non-null assertion.
export async function sb(
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
export async function uid(): Promise<string | null> {
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
export async function createdByFields(): Promise<{ created_by?: string }> {
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
export function fromRow<T>(row: unknown): T {
  return toCamelCaseKeys(row as Record<string, unknown>) as unknown as T;
}

/** {@link fromRow} for a result set. */
export function fromRows<T>(rows: unknown): T[] {
  return (rows as Record<string, unknown>[]).map((row) => fromRow<T>(row));
}

/**
 * Fetch every row of `table`, newest first by default, as domain objects.
 *
 * @param table   Table to read; constrained to real tables by the generated types.
 * @param orderBy Column to sort on.
 * @param ascending Sort direction. Defaults to descending (newest first).
 */
export async function fetchAll<T>(
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
export function mutationSideEffects<T>(
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
