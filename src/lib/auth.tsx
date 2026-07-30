/**
 * Authentication provider for DMP CMS. Supabase Auth, email/password + Google.
 *
 * Demo mode was removed deliberately. It set `isAuthenticated` true with no
 * session — an authentication bypass reachable from a button in the production
 * build, on a system holding burial and financial records. It also never worked
 * as a demo: RLS grants are `TO authenticated`, so a demo session issued anon
 * queries and every screen rendered its empty state. A stakeholder demo, if one
 * is ever needed, belongs on a seeded Supabase branch with a real account.
 *
 * There is no `signUp`. Accounts are provisioned by an admin (see docs/06-supabase.md);
 * self-service registration on a staff tool for a private cemetery is not wanted.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"

interface LocalUser {
  id: string
  email: string
  name: string
  role: string
}

export interface AuthContextType {
  user: User | null
  currentUser: LocalUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const isAuthenticated = user !== null

  const currentUser: LocalUser | null = user
    ? {
        id: user.id,
        email: user.email || '',
        name: (user.user_metadata?.name as string) || user.email || 'User',
        // NOTE: read from user_metadata, which is user-writable, so this is a
        // display value only — never an authorization decision. Role moves to a
        // `profiles` table when RBAC lands.
        role: (user.user_metadata?.role as string) || 'staff',
      }
    : null

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const login = signIn

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  /**
   * Awaited, and falls back to clearing the local session on failure. The old
   * fire-and-forget version could leave a live session in localStorage behind a
   * logged-out UI — on a shared office workstation the next page load would
   * silently re-authenticate as the previous user.
   */
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    } finally {
      setSession(null)
      setUser(null)
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const value: AuthContextType = {
    user,
    currentUser,
    session,
    isLoading,
    isAuthenticated,
    login,
    logout,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
