/**
 * Runtime validation of the browser-visible environment.
 *
 * The client previously fell back to placeholder values when Supabase env vars
 * were missing, so a misconfigured deploy looked exactly like a Supabase outage:
 * every query failed with a network error against `missing-supabase-url.invalid`
 * and the only signal was a console warning nobody reads. Parsing the env up
 * front lets `main.tsx` render a screen that names the missing variable instead.
 *
 * Deliberately runtime, not build-time: failing the Vite build would turn a
 * config problem into a deploy outage, and preview builds legitimately vary.
 *
 * Deliberately hand-rolled rather than zod: this module is imported by
 * `main.tsx`, so anything it imports lands in the entry chunk. Using zod here
 * pulled the whole 62 kB schema library out of its lazy chunk and onto the
 * critical path of every page load, including the login screen. A handful of
 * hand-rolled checks are not worth that — do not import zod into this file.
 */

export interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

export interface EnvIssue {
  key: string;
  message: string;
}

export type EnvResult =
  | { ok: true; env: Env }
  | { ok: false; issues: EnvIssue[] };

/** Minimum plausible length for a Supabase anon key (a JWT is far longer). */
const MIN_KEY_LENGTH = 20;

/** Hostnames allowed to be served over plain `http:` — local development only. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * The Supabase URL must be https in every real deployment.
 *
 * Plain http was previously accepted, which would have shipped every access
 * token and every row of burial and financial data over the wire in clear text
 * had a URL ever been mistyped or copied from a local example. Localhost is the
 * one exception: `supabase start` serves the local stack over http on 54321.
 */
function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Decode base64url to bytes.
 *
 * Hand-rolled rather than `atob` on purpose. Beyond `atob` needing base64url
 * translated to base64 and re-padded first, jsdom's implementation rejects
 * perfectly valid input that Node's accepts, and is slow enough to add tens of
 * seconds to the test run. Twelve lines of bit-shifting is cheaper than that in
 * every sense, and behaves identically everywhere.
 *
 * @returns The decoded bytes, or `null` on any character outside the alphabet.
 */
function decodeBase64Url(value: string): Uint8Array | null {
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;

  for (const char of value) {
    if (char === '=') break; // Padding; nothing meaningful follows.
    const index = BASE64URL_ALPHABET.indexOf(
      char === '+' ? '-' : char === '/' ? '_' : char,
    );
    if (index === -1) return null;

    accumulator = (accumulator << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Decode a JWT's payload without verifying it.
 *
 * Verification is neither possible nor the point here: the signing secret is not
 * (and must never be) in the browser bundle. We only need the self-declared
 * `role` claim, which is enough to catch the paste-the-wrong-key mistake below.
 * A forged claim is not a threat model — someone who can edit the deploy's env
 * vars already has everything this check protects.
 *
 * @returns The decoded payload object, or `null` if the value is not a JWT or
 *          its payload is not decodable JSON.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;

  const bytes = decodeBase64Url(segments[1]);
  if (bytes === null) return null;

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Reject any key that is not a browser-safe anon/publishable key.
 *
 * The `service_role` key sits directly beside the anon key in the Supabase
 * dashboard, is the same shape, and looks identical at a glance. Pasting it into
 * `VITE_SUPABASE_ANON_KEY` ships a key that **bypasses every RLS policy** to
 * every browser that loads the app — total read/write access to burial and
 * financial records for anyone who opens devtools. Nothing else in the pipeline
 * catches this: it is a valid key, so the app works perfectly, which is exactly
 * what makes it dangerous.
 *
 * Two key formats exist:
 *   - Legacy JWTs, whose payload carries `role: 'anon' | 'service_role'`.
 *   - Current-format keys, prefixed `sb_publishable_` (safe) or `sb_secret_`
 *     (server-only), which are opaque and carry no decodable claims.
 *
 * @returns An error message when the key must not be used in a browser, else `null`.
 */
function browserUnsafeKeyReason(key: string): string | null {
  if (key.startsWith('sb_secret_')) {
    return 'is a secret (server-only) key — use the publishable key, never sb_secret_*';
  }

  const payload = decodeJwtPayload(key);
  if (payload && typeof payload.role === 'string' && payload.role !== 'anon') {
    return `is a "${payload.role}" key, not the anon key — a service_role key in the browser bypasses every RLS policy`;
  }

  return null;
}

export function readEnv(raw: Record<string, unknown> = import.meta.env): EnvResult {
  const issues: EnvIssue[] = [];

  const url = typeof raw.VITE_SUPABASE_URL === 'string' ? raw.VITE_SUPABASE_URL.trim() : '';
  const key = typeof raw.VITE_SUPABASE_ANON_KEY === 'string' ? raw.VITE_SUPABASE_ANON_KEY.trim() : '';

  if (!url) {
    issues.push({ key: 'VITE_SUPABASE_URL', message: 'is not set' });
  } else if (!isUrl(url)) {
    issues.push({
      key: 'VITE_SUPABASE_URL',
      message: 'must be a full URL, e.g. https://your-project.supabase.co',
    });
  }

  if (!key) {
    issues.push({ key: 'VITE_SUPABASE_ANON_KEY', message: 'is not set' });
  } else if (key.length < MIN_KEY_LENGTH) {
    issues.push({
      key: 'VITE_SUPABASE_ANON_KEY',
      message: 'is too short to be a valid Supabase anon key',
    });
  } else {
    const unsafe = browserUnsafeKeyReason(key);
    if (unsafe) {
      issues.push({ key: 'VITE_SUPABASE_ANON_KEY', message: unsafe });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key } };
}

export const envResult = readEnv();
