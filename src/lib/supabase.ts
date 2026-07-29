/**
 * Supabase client. Project ref: mgpwjnxtqcnoyjgebytg (us-east-1).
 *
 * Typed against the generated schema in `../types/database`, so `.from('table')`
 * knows the real column set: an unknown table name, or an insert naming a column
 * that does not exist, is a compile error rather than a runtime 400. That is not
 * hypothetical — `grants.created_by` was being written to a column that had never
 * been added, and every grant insert failed in production until it was caught by
 * querying the live schema by hand.
 *
 * An earlier hand-rolled Database type was removed (commit 79ae3c3) because it
 * covered only 3 of 13 tables and named a since-dropped `users` table. This one
 * is generated from the live schema, so it cannot drift by hand — see the header
 * of `../types/database` for how to regenerate it.
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Use placeholder values when env vars are missing so the bundle loads in
// preview environments / demo mode without throwing at module init. Any actual
// network call will fail fast with a recognizable URL (helpful for debugging).
const PLACEHOLDER_URL = 'https://missing-supabase-url.invalid'
const PLACEHOLDER_KEY = 'missing-supabase-anon-key'

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase env vars not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'The app will load but live data calls will fail. Demo mode still works.'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseKey || PLACEHOLDER_KEY,
)
