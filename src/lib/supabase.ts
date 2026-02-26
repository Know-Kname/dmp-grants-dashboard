import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Guard: only throw at runtime when NOT in demo/preview mode.
 * This prevents a blank white-screen crash when the app is opened
 * for demo purposes without Supabase env vars configured.
 */
const isDemoOnlyBuild = !supabaseUrl || !supabaseKey

if (isDemoOnlyBuild) {
  console.warn(
    '[DMP] Supabase env vars not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'The app will run in demo-only mode. ' +
    'Live data features will be disabled.'
  )
}

// We still create a client even with dummy values so module imports don't fail.
// Actual Supabase calls will fail gracefully rather than crashing on import.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder-key'
)

export { isDemoOnlyBuild }

// ─── Supabase DB Type Definitions ──────────────────────────────────────────────
// NOTE: Expand these to match your full schema as you add tables.
// Dates are strings here (Supabase returns ISO strings, not Date objects).
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
          completed_date: string | null
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
          completed_date?: string | null
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
          completed_date?: string | null
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
