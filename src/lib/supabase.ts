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
 *
 * Env vars are validated in `./env`. When they are missing the app renders a
 * config screen instead of mounting, so the placeholders below are only ever
 * reached under vitest.
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../types/database"
import { envResult } from "./env"

const TEST_URL = 'http://localhost:54321'
const TEST_KEY = 'test-anon-key-not-used-for-real-requests'

const url = envResult.ok ? envResult.env.VITE_SUPABASE_URL : TEST_URL
const key = envResult.ok ? envResult.env.VITE_SUPABASE_ANON_KEY : TEST_KEY

export const supabase = createClient<Database>(url, key, {
  auth: {
    // PKCE is the correct flow for a browser SPA and makes the OAuth and
    // password-recovery redirects deterministic — both land on a route that
    // reads the code from the URL rather than relying on implicit-grant timing.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
