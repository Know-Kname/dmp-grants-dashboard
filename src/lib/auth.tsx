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
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react"
import { User, Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import { clearAuthStorage } from "./authStorage"
import { getQueryClient } from "./query"
import { profilesTable, type Profile, type ProfileRow } from "./profiles"
import { can, toAppRole, type AppRole, type PermissionAction } from "./permissions"
import {
  beginRecoverySession,
  endRecoverySession,
  hasPasswordRecoveryFired,
  onPasswordRecovery,
} from "./recovery"

interface LocalUser {
  id: string
  email: string
  name: string
  /**
   * The signed-in user's role, from `public.profiles` — `null` until the
   * profile has loaded, and whenever it could not be loaded or the account is
   * deactivated.
   *
   * It used to be read from `user.user_metadata.role`, which is writable by the
   * user themselves via `updateUser({ data: { role: 'admin' } })`. That made it
   * a display string at best and a self-service promotion at worst; nothing may
   * key off it. `profiles.role` is only writable by admins (RLS), which is what
   * makes this value worth reading.
   */
  role: AppRole | null
}

/**
 * How far the `profiles` lookup for the signed-in user has got.
 *
 * - `idle`         — nobody is signed in, so there is nothing to look up.
 * - `loading`      — request in flight; the app must not decide anything yet.
 * - `active`       — profile found, `is_active = true`. Normal operation.
 * - `deactivated`  — profile found, `is_active = false`. RLS lets this user
 *                    read *nothing*, so without special handling they would see
 *                    a fully-loaded app in which every screen is empty. That
 *                    looks like data loss. It gets its own screen instead.
 * - `missing`      — authenticated, but no profile row. The `auth.users` trigger
 *                    should make this impossible; it is reachable for accounts
 *                    created before the trigger existed.
 * - `error`        — the lookup itself failed (offline, transient 5xx). Distinct
 *                    from `missing`: retrying is the right response.
 */
export type ProfileStatus =
  | "idle"
  | "loading"
  | "active"
  | "deactivated"
  | "missing"
  | "error"

export interface AuthContextType {
  user: User | null
  currentUser: LocalUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  /** Role from `profiles`; `null` unless the profile loaded and is active. */
  role: AppRole | null
  /** The full profile row, or `null` when it has not loaded (or is inactive). */
  profile: Profile | null
  profileStatus: ProfileStatus
  /** Whatever the `profiles` lookup threw, for `<PageError>`. */
  profileError: unknown
  /** Re-run the `profiles` lookup — the retry button on the error screen. */
  refreshProfile: () => void
  /**
   * `can(role, action)` bound to the signed-in user. A convenience only: the
   * database is what actually enforces this. See `./permissions`.
   */
  can: (action: PermissionAction) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

/** Columns of `profiles` this app reads. Spelled out so a schema addition
 *  cannot quietly widen what the client pulls down. */
const PROFILE_COLUMNS = "id, email, full_name, role, is_active, created_at, updated_at"

/** snake_case row → the camelCase shape components speak. */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: toAppRole(row.role),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle')
  const [profileError, setProfileError] = useState<unknown>(null)
  /** Bumped by `refreshProfile()` to re-run the lookup effect. */
  const [profileNonce, setProfileNonce] = useState(0)

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

    // A recovery session is fully privileged, so the moment one appears the app
    // is gated to `/reset-password` until the password is actually changed (see
    // `./recovery`). Both arms are needed: the latch covers an event emitted
    // before this component mounted, the subscription covers one after.
    if (hasPasswordRecoveryFired()) beginRecoverySession()
    const unlatch = onPasswordRecovery(beginRecoverySession)

    return () => {
      subscription.unsubscribe()
      unlatch()
    }
  }, [])

  const isAuthenticated = user !== null

  /**
   * Load `public.profiles` for the signed-in user.
   *
   * Keyed on the user id (not the whole `user` object, which is a fresh
   * reference on every token refresh) plus a nonce that `refreshProfile` bumps.
   *
   * `maybeSingle()` rather than `single()`: "no row" is a state this app has to
   * distinguish and explain, not a request error. Note RLS already narrows the
   * table to this user's own row, so the `.eq('id', …)` is belt-and-braces.
   */
  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      setProfileStatus('idle')
      return
    }

    let cancelled = false
    setProfileStatus('loading')
    setProfileError(null)

    profilesTable()
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProfile(null)
          setProfileError(new Error(error.message))
          setProfileStatus('error')
          return
        }
        if (!data) {
          setProfile(null)
          setProfileError(null)
          setProfileStatus('missing')
          return
        }
        const loaded = toProfile(data as ProfileRow)
        setProfile(loaded)
        setProfileError(null)
        setProfileStatus(loaded.isActive ? 'active' : 'deactivated')
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, profileNonce])

  const refreshProfile = useCallback(() => setProfileNonce((n) => n + 1), [])

  /**
   * The effective role.
   *
   * Deliberately `null` for anything other than a loaded, active profile:
   * `can()` then answers `false` for every action, so a half-loaded or broken
   * profile shows the least-privileged UI rather than briefly flashing buttons
   * the server would refuse.
   */
  const role: AppRole | null =
    profileStatus === 'active' && profile ? profile.role : null

  const currentUser: LocalUser | null = user
    ? {
        id: user.id,
        email: profile?.email || user.email || '',
        name:
          profile?.fullName ||
          (user.user_metadata?.name as string) ||
          user.email ||
          'User',
        role,
      }
    : null

  const canDo = useCallback(
    (action: PermissionAction) => can(role, action),
    [role]
  )

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

  /**
   * Sign out in a way that cannot leave a live session behind.
   *
   * `supabase.auth.signOut()` is not network-independent, and the failure mode
   * is silent. `GoTrueClient._signOut` calls `admin.signOut()` first and, if that
   * *returns* an error which is not an `AuthApiError` with status 404/401/403,
   * returns early — before `_removeSession()` ever runs:
   *
   * ```js
   * const { error } = await this.admin.signOut(accessToken, scope)
   * if (error) {
   *   if (!((isAuthApiError(error) && (404|401|403)) || isAuthSessionMissingError(error))) {
   *     return this._returnResult({ error })   // ← returns; storage untouched
   *   }
   * }
   * if (scope !== 'others') { await this._removeSession() }   // ← never reached
   * ```
   *
   * An offline or flaky network yields `AuthRetryableFetchError`, which is *not*
   * an `AuthApiError`. So the refresh token stays in `localStorage` while the UI
   * happily shows a signed-out state, and the next page load restores the
   * session. On a shared office workstation holding burial and financial records,
   * "I clicked sign out" has to mean it.
   *
   * Note the error is **returned, not thrown**, which is why the previous
   * `try/catch` + `.catch()` fallback never ran: nothing ever threw.
   *
   * Two consequences, both deliberate:
   *   - the returned error is inspected, and on *any* failure the auth storage is
   *     purged directly, so clearing does not depend on the network at all;
   *   - the React Query cache is cleared unconditionally. It is keyed by table,
   *     not by user, so without this the next person to sign in on the same tab
   *     is served the previous user's burial and financial rows out of cache
   *     until each query refetches.
   */
  /**
   * Drop the cached profile synchronously on sign-out.
   *
   * The lookup effect would do this anyway when `user` becomes `null`, but only
   * after the next render — long enough for one paint of the previous user's
   * name and role. On a shared office workstation that is the wrong frame to
   * render.
   */
  const clearProfileState = () => {
    setProfile(null)
    setProfileError(null)
    setProfileStatus('idle')
  }

  const signOutEverywhere = async () => {
    endRecoverySession()

    let failure: unknown = null
    try {
      const { error } = await supabase.auth.signOut()
      if (error) failure = error
    } catch (err) {
      failure = err
    }

    // Belt and braces: harmless when signOut succeeded (the keys are already
    // gone), decisive when it bailed out before removing them.
    clearAuthStorage()

    getQueryClient().clear()

    return failure
  }

  /**
   * Context `signOut`. Surfaces the failure so a caller can report it, but the
   * local session is already gone by the time it throws.
   */
  const signOut = async () => {
    const failure = await signOutEverywhere()
    setSession(null)
    setUser(null)
    clearProfileState()
    if (failure) throw failure
  }

  /**
   * The UI sign-out button. Never throws — the user asked to be signed out, and
   * they are, locally and unconditionally. A failure to reach the server means
   * the refresh token could not be revoked server-side; the session is still
   * unusable from this browser.
   */
  const logout = async () => {
    await signOutEverywhere()
    setSession(null)
    setUser(null)
    clearProfileState()
  }

  /**
   * Email a password-reset link.
   *
   * `redirectTo` only governs the `?code=` (PKCE) form of the link, which can
   * only be completed in *this* browser — see the header of `/reset-password`.
   * The device-independent token-hash form is produced by the Supabase email
   * template, not by anything callable from here; configuring it is a dashboard
   * change documented in `docs/06-supabase.md`. `/reset-password` accepts both.
   */
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  /**
   * Set a new password for the current session's user.
   *
   * Supabase requires no current-password challenge here, so the *caller* is
   * responsible for having established that a recovery genuinely happened —
   * see `/reset-password`, which will not render its form otherwise.
   *
   * On success every other session for this user is revoked. A password reset is
   * usually prompted by "someone may have my password" or by losing a device;
   * leaving the sessions that motivated the reset alive would defeat it. Scope
   * `'others'` keeps the current session (auth-js skips `_removeSession()` for
   * that scope), so the user stays signed in on the device they just used.
   */
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error

    // The recovery is complete: lift the gate before revoking siblings, so a
    // failure below cannot strand the user on the reset screen.
    endRecoverySession()

    const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
    if (revokeError) {
      // Non-fatal: the password *was* changed, which is what the user asked for.
      // Reporting failure here would wrongly suggest otherwise.
      console.warn('Could not revoke other sessions after password change', revokeError)
    }
  }

  const value: AuthContextType = {
    user,
    currentUser,
    session,
    isLoading,
    isAuthenticated,
    role,
    profile,
    profileStatus,
    profileError,
    refreshProfile,
    can: canDo,
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
