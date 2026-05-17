import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const PLACEHOLDER_URL = 'https://missing-supabase-url.invalid'
const PLACEHOLDER_KEY = 'missing-supabase-anon-key'

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase env vars not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'The app will load in demo mode (localStorage mock data).'
  )
}

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseKey || PLACEHOLDER_KEY,
)
