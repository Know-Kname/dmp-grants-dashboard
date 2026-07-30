/**
 * Direct access to the browser storage that supabase-js keeps the session in.
 *
 * Reaching around a library into its own storage is normally a mistake. Here it
 * is load-bearing, for two reasons that both trace to auth-js internals:
 *
 * 1. `signOut()` is not network-independent. `GoTrueClient._signOut` calls
 *    `admin.signOut()` first and, when that *returns* an error that is not an
 *    `AuthApiError` with status 404/401/403, returns early — before
 *    `_removeSession()` runs. A network failure produces an
 *    `AuthRetryableFetchError`, which is not an `AuthApiError`, so the session
 *    survives in `localStorage` while the UI shows a logged-out state. The next
 *    page load silently re-authenticates as the user who "signed out". On a
 *    shared office workstation that is the whole ballgame.
 *
 * 2. The recovery-link snapshot in `./recovery` needs to know whether a PKCE
 *    code verifier exists in *this* browser, and must check before auth-js
 *    consumes and deletes it during client initialization.
 *
 * Neither is served by a public API, so the storage key is reconstructed here.
 *
 * @see node_modules/@supabase/auth-js/dist/main/GoTrueClient.js — `_signOut`
 */
import { envResult } from './env';

/**
 * supabase-js derives its default storage key as
 * `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
 * (see `SupabaseClient`'s constructor). We do not pass an explicit `storageKey`,
 * so this must mirror that formula exactly.
 *
 * `clearAuthStorage` does not rely on this being right — it also sweeps by
 * pattern — but naming the expected key keeps the intent legible and makes the
 * common case exact rather than heuristic.
 *
 * @returns The base storage key, or `null` when the env is unusable (tests,
 *          misconfigured deploy) and there is nothing meaningful to derive.
 */
export function authStorageKey(): string | null {
  if (!envResult.ok) return null;
  try {
    const { hostname } = new URL(envResult.env.VITE_SUPABASE_URL);
    return `sb-${hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** Storage key holding the PKCE code verifier for an in-flight exchange. */
export function codeVerifierStorageKey(): string | null {
  const base = authStorageKey();
  return base === null ? null : `${base}-code-verifier`;
}

/**
 * Whether a PKCE code verifier is present in this browser right now.
 *
 * Used to tell "this reset link was opened on the machine that requested it"
 * apart from "this link was opened somewhere else", which are indistinguishable
 * by the time auth-js has given up on the exchange.
 */
export function hasCodeVerifier(): boolean {
  const key = codeVerifierStorageKey();
  if (key === null) return false;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    // Private-browsing / blocked storage. Absence is the safe assumption.
    return false;
  }
}

/**
 * The user ID already signed in when this page began loading, if any.
 *
 * Snapshotted at module evaluation — which, because `./recovery` imports this
 * file and `./supabase` imports `./recovery` before calling `createClient`, is
 * guaranteed to run *before* auth-js can perform any URL code exchange and
 * overwrite the stored session.
 *
 * `/auth/callback` needs this to tell a successful sign-in from a failed one.
 * auth-js keeps the previous session when a URL login fails, and
 * `onAuthStateChange`'s `INITIAL_SESSION` is only emitted after
 * `initializePromise` resolves — i.e. after the exchange — so neither of those
 * can reveal who was signed in beforehand.
 */
export const preExistingUserId: string | null = readStoredUserId();

function readStoredUserId(): string | null {
  const key = authStorageKey();
  if (key === null || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const user = (parsed as { user?: unknown }).user;
    if (typeof user !== 'object' || user === null) return null;
    const id = (user as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/**
 * Remove every trace of the Supabase session from browser storage.
 *
 * Deliberately belt-and-braces. It removes the exact keys auth-js writes
 * (`<key>`, `<key>-user`, `<key>-code-verifier`) *and* sweeps anything matching
 * `sb-*-auth-token*`, so a change to supabase-js's key formula, or a stale key
 * left behind by a previous Supabase project ref, cannot leave a live refresh
 * token sitting on a shared workstation.
 *
 * Storage access is wrapped: this runs on the sign-out path, where throwing
 * would be strictly worse than failing to clear one key.
 */
export function clearAuthStorage(): void {
  const base = authStorageKey();

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      if (base !== null) {
        storage.removeItem(base);
        storage.removeItem(`${base}-user`);
        storage.removeItem(`${base}-code-verifier`);
      }

      // Collect first: removing while iterating by index skips entries.
      const stale: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key !== null && /^sb-.+-auth-token/.test(key)) stale.push(key);
      }
      for (const key of stale) storage.removeItem(key);
    } catch {
      // Storage unavailable — nothing to clear, and nothing useful to report.
    }
  }
}
