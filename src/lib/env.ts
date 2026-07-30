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
 * critical path of every page load, including the login screen. Two string
 * checks are not worth that.
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

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key } };
}

export const envResult = readEnv();
