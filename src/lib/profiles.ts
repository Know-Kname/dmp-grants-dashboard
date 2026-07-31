/**
 * Types for `public.profiles`, the table that holds each user's role.
 *
 * This file previously widened the Supabase client with
 * `supabase as unknown as SupabaseClient` and hand-wrote the row shape, because
 * `src/types/database.ts` had not yet been regenerated with `profiles` in it.
 * That stopgap is gone: `database.ts` now knows the table, so `ProfileRow` is
 * derived from the generated types and `profilesTable()` is the ordinary typed
 * builder. There is no untyped surface left here, and no hand-written shape
 * that can drift from the schema.
 *
 * What remains is the snake_case/camelCase boundary the rest of the app already
 * observes: `ProfileRow` is what Postgres stores, `Profile` is what components
 * speak, and `toCamelCaseKeys` in `lib/utils.ts` converts between them.
 */
import { supabase } from './supabase';
import type { Tables } from '../types/database';
import type { AppRole } from './permissions';

/**
 * A row of `public.profiles`, snake_case, as Postgres stores it.
 *
 * Note `role` arrives as `string`, not `AppRole`: it is a `text` column with a
 * CHECK constraint, and the generated types cannot express that constraint — so
 * a build older than the database could meet a value it has never heard of.
 * `toAppRole()` in `./permissions` does the narrowing, and returns null rather
 * than guessing.
 */
export type ProfileRow = Tables<'profiles'>;

/** The camelCase domain shape components speak, after `toCamelCaseKeys`. */
export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The typed Supabase query builder for `profiles`, on the app's client. */
export function profilesTable() {
  return supabase.from('profiles');
}
