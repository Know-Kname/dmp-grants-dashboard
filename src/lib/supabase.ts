/**
 * Supabase client. Project ref: mgpwjnxtqcnoyjgebytg (us-east-1).
 *
 * The client is intentionally untyped — `.from('any_table')` returns rows as
 * `Record<string, unknown>` and useData.ts converts to camelCase. To enable
 * full table typing, run:
 *   npx supabase login
 *   npx supabase gen types typescript --project-id mgpwjnxtqcnoyjgebytg > src/types/database.ts
 * then change the line below to `createClient<Database>(...)` and import the
 * generated type. (This was the previous approach; the hand-rolled Database
 * type was removed because it covered only 3 of 13 tables and listed `users`,
 * which was dropped in 20260506013416_drop_template_tables.)
 */
import { createClient } from "@supabase/supabase-js"

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

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseKey || PLACEHOLDER_KEY,
)
