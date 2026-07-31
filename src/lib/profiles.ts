/**
 * Access to `public.profiles`, the table that holds each user's role.
 *
 * Why this file exists at all: `src/types/database.ts` is generated from the
 * live schema and is regenerated separately from this change, so at the moment
 * it does not know `profiles`. `supabase.from('profiles')` is therefore a
 * compile error against the typed client — and `@ts-ignore` is banned by the
 * project's lint rules, correctly.
 *
 * So the client is widened *once*, here, behind a named function, with the row
 * shape written out by hand below. Nothing else in the app reaches `profiles`
 * without going through `profilesTable()`, which keeps the untyped surface to a
 * single auditable line instead of scattering casts through `useData.ts` and
 * `auth.tsx`.
 *
 * TO REMOVE THIS FILE: once `database.ts` is regenerated with `profiles` in it,
 * `ProfileRow` can be replaced by `Tables<'profiles'>` and `profilesTable()` by
 * a plain `supabase.from('profiles')`. The widening is a stopgap, not a design.
 * The hand-written `ProfileRow` is the risk it carries: it can drift from the
 * real schema, which is exactly what the generated types exist to prevent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppRole } from './permissions';

/**
 * A row of `public.profiles`, snake_case, as Postgres stores it.
 *
 * `role` is typed loosely as `string` on purpose: it is a `text` column with a
 * CHECK constraint, and a build older than the database could meet a value it
 * has never heard of. `toAppRole()` in `./permissions` does the narrowing.
 */
export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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

/**
 * The Supabase query builder for `profiles`, on the *same* client instance as
 * the rest of the app (so it carries the same session), with the schema
 * generic widened.
 */
export function profilesTable() {
  return (supabase as unknown as SupabaseClient).from('profiles');
}
