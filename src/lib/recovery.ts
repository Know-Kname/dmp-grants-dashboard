/**
 * Evidence that a password recovery is genuinely in progress.
 *
 * ## Why this module exists at all
 *
 * `/reset-password` used to render its form whenever *any* session existed:
 *
 * ```ts
 * if (event === 'PASSWORD_RECOVERY' || session) setStatus('ready')
 * ```
 *
 * `updateUser({ password })` changes the password of whoever the *current*
 * session belongs to, and Supabase asks for no current-password challenge. So on
 * a shared workstation where a staff member is already signed in, anyone who
 * typed `/reset-password` into the address bar got a working form pointed at
 * that person's account. Account takeover with no credentials and no email.
 *
 * The same hole opens a second way: opening user B's recovery link in a browser
 * holding user A's session. auth-js deliberately does **not** clear an existing
 * session when a URL login fails ("Don't remove existing session on URL login
 * failure", `GoTrueClient._initialize`), so A's session survives, `session` is
 * truthy, and the form rewrites A's password while displaying "Password updated."
 *
 * A session is therefore not evidence of anything. The only sound signal is:
 * *did a recovery happen during this page load* — which means (a) the URL that
 * loaded this page carried recovery credentials, and (b) exchanging them
 * actually produced a `PASSWORD_RECOVERY` event.
 *
 * ## Why the snapshot is taken at module scope
 *
 * Both halves of that signal are destroyed by the time a React component can
 * look for them:
 *
 * - auth-js strips the credentials from the URL as soon as it consumes them
 *   (`url.searchParams.delete('code')` + `window.location.hash = ''` in
 *   `_getSessionFromURL`), and that runs during `createClient`, long before
 *   React renders.
 * - `PASSWORD_RECOVERY` is emitted via `setTimeout(..., 0)` right after the
 *   exchange, to whichever subscribers exist *at that moment*. A component that
 *   subscribes in `useEffect` can easily miss it.
 *
 * So this module snapshots the URL when it is first evaluated, and latches the
 * event from a listener registered immediately after `createClient`. It must be
 * imported by `./supabase` *before* the client is constructed — that import
 * ordering is what makes the snapshot trustworthy. Nothing here may import
 * `./supabase`, or the cycle would defeat the point.
 */
import { hasCodeVerifier } from './authStorage';

/** How a recovery link delivered its credentials, if it delivered any. */
export type RecoveryLinkKind =
  /** `?token_hash=…&type=recovery` — verified by us, works in any browser. */
  | 'token_hash'
  /** `?code=…` — PKCE, requires the verifier stored by the requesting browser. */
  | 'pkce'
  /** `#access_token=…&type=recovery` — implicit grant, consumed by auth-js. */
  | 'implicit'
  /** The link reported its own failure (expired, already used). */
  | 'error'
  /** No recovery credentials in the URL at all. */
  | 'none';

export interface RecoveryLink {
  kind: RecoveryLinkKind;
  /** Present when `kind === 'token_hash'`. */
  tokenHash: string | null;
  /** Human-readable failure from the link itself, when `kind === 'error'`. */
  errorDescription: string | null;
  /**
   * Whether this browser held a PKCE code verifier when the page loaded.
   *
   * Only meaningful for `kind === 'pkce'`. False means the link was opened on a
   * different device or browser from the one that requested it — the single most
   * common real-world reset flow (request on the office desktop, open the email
   * on a phone), and one that auth-js does not even attempt, because
   * `_isPKCECallback` requires `params.code && <verifier in storage>`.
   */
  hadCodeVerifier: boolean;
}

function readRecoveryLink(): RecoveryLink {
  const empty: RecoveryLink = {
    kind: 'none',
    tokenHash: null,
    errorDescription: null,
    hadCodeVerifier: false,
  };

  if (typeof window === 'undefined') return empty;

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const param = (name: string) => query.get(name) ?? hash.get(name);

  // A link that announces its own failure wins over everything else: there is
  // nothing to exchange and the server already said why.
  const errorDescription = param('error_description');
  const errorCode = param('error');
  if (errorDescription || errorCode) {
    return {
      ...empty,
      kind: 'error',
      errorDescription: errorDescription
        ? errorDescription.replace(/\+/g, ' ')
        : 'This link is no longer valid.',
    };
  }

  const type = param('type');
  const tokenHash = param('token_hash');
  if (tokenHash && type === 'recovery') {
    return { ...empty, kind: 'token_hash', tokenHash };
  }

  const code = param('code');
  if (code) {
    return { ...empty, kind: 'pkce', hadCodeVerifier: hasCodeVerifier() };
  }

  if (param('access_token') && type === 'recovery') {
    return { ...empty, kind: 'implicit' };
  }

  return empty;
}

/**
 * The recovery credentials carried by the URL that loaded this page.
 *
 * Frozen at first module evaluation. Reading `window.location` later gives a URL
 * auth-js has already scrubbed.
 */
export const initialRecoveryLink: RecoveryLink = readRecoveryLink();

// --- PASSWORD_RECOVERY latch -----------------------------------------------

let recoveryEventSeen = false;
const recoveryEventListeners = new Set<() => void>();

/**
 * Record that auth-js emitted `PASSWORD_RECOVERY` during this page load.
 *
 * Called from `./supabase`'s listener, which is registered immediately after
 * `createClient` precisely so that no emission can be missed.
 */
export function markPasswordRecovery(): void {
  if (recoveryEventSeen) return;
  recoveryEventSeen = true;
  for (const listener of recoveryEventListeners) listener();
}

/** Whether `PASSWORD_RECOVERY` has fired at any point during this page load. */
export function hasPasswordRecoveryFired(): boolean {
  return recoveryEventSeen;
}

/** Subscribe to the latch flipping. Returns an unsubscribe function. */
export function onPasswordRecovery(listener: () => void): () => void {
  recoveryEventListeners.add(listener);
  return () => {
    recoveryEventListeners.delete(listener);
  };
}

// --- "recovery session, password not yet changed" gate ----------------------

/**
 * A recovery session is a full app session.
 *
 * Supabase issues a real, fully privileged session the moment a recovery link is
 * exchanged — it is not scoped to "may change password". Without a gate, anyone
 * holding a working reset link can click through to `/burials` or `/financial`
 * and read every record without ever setting a password, and can keep doing so
 * for the life of the session. That turns a one-hour email link into
 * indefinite read access.
 *
 * So while a recovery is pending, `ProtectedRoute` sends the user back to
 * `/reset-password` until the update completes.
 *
 * Kept in `sessionStorage` rather than module state so it survives a reload of
 * the tab (otherwise refreshing the page would lift the restriction while the
 * privileged session stayed live), and dies with the tab.
 */
const PENDING_KEY = 'dmp-recovery-pending';

const pendingListeners = new Set<() => void>();

function readPending(): boolean {
  try {
    return window.sessionStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

let recoveryPending = typeof window === 'undefined' ? false : readPending();

function setRecoveryPendingInternal(value: boolean): void {
  if (recoveryPending === value) return;
  recoveryPending = value;
  try {
    if (value) window.sessionStorage.setItem(PENDING_KEY, '1');
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked; the in-memory flag still gates this page load.
  }
  for (const listener of pendingListeners) listener();
}

/** Mark that a recovery session exists whose password has not been changed yet. */
export function beginRecoverySession(): void {
  setRecoveryPendingInternal(true);
}

/** Clear the gate — on a completed password update, or on sign-out. */
export function endRecoverySession(): void {
  setRecoveryPendingInternal(false);
}

/** `useSyncExternalStore` snapshot: is a recovery still awaiting its update? */
export function isRecoveryPending(): boolean {
  return recoveryPending;
}

/** `useSyncExternalStore` subscribe. Returns an unsubscribe function. */
export function subscribeRecoveryPending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}
