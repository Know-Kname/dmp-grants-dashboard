/**
 * Supabase client initialization. Project ref: mgpwjnxtqcnoyjgebytg (us-east-1).
 * The Database type parameter covers only 3 tables (burials, contracts, work_orders).
 * Newer tables (cemeteries, sections, lots, graves, payment_schedule, vendors) use
 * untyped queries via .from() — extend src/types/index.ts + regenerate types to fix.
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

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          updated_at?: string
        }
      }
      work_orders: {
        Row: {
          id: string
          title: string
          description: string
          type: string
          priority: string
          status: string
          assigned_to: string | null
          due_date: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          type: string
          priority: string
          status?: string
          assigned_to?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          type?: string
          priority?: string
          status?: string
          assigned_to?: string | null
          due_date?: string | null
          updated_at?: string
        }
      }
      grants: {
        Row: {
          id: string
          title: string
          description: string | null
          type: string
          source: string
          amount: number | null
          deadline: string | null
          status: string
          application_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type: string
          source: string
          amount?: number | null
          deadline?: string | null
          status?: string
          application_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: string
          source?: string
          amount?: number | null
          deadline?: string | null
          status?: string
          application_date?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
    }
  }
}
