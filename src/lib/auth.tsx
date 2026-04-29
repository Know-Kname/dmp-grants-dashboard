import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import { DEMO_USER, disableDemoMode } from "./demo-data"

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
  isDemo: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDemoActive, setIsDemoActive] = useState(() => localStorage.getItem('dmp-demo-mode') === 'true')

  // React to demo mode toggled from outside (Login page, logout, etc.)
  useEffect(() => {
    const handler = (e: Event) => setIsDemoActive((e as CustomEvent<boolean>).detail)
    window.addEventListener('dmp-demo-change', handler)
    return () => window.removeEventListener('dmp-demo-change', handler)
  }, [])

  useEffect(() => {
    if (isDemoActive) {
      setIsLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [isDemoActive])

  const isDemo = isDemoActive

  const isAuthenticated = user !== null || isDemo

  const currentUser: LocalUser | null = user
    ? {
        id: user.id,
        email: user.email || '',
        name: (user.user_metadata?.name as string) || user.email || 'User',
        role: (user.user_metadata?.role as string) || 'staff',
      }
    : isDemo
    ? { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name, role: DEMO_USER.role }
    : null

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const login = signIn

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const logout = () => {
    disableDemoMode()
    supabase.auth.signOut()
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: "user" } },
    })
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const value: AuthContextType = {
    user,
    currentUser,
    session,
    isLoading,
    isAuthenticated,
    isDemo,
    login,
    logout,
    signIn,
    signUp,
    signOut,
    resetPassword,
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
