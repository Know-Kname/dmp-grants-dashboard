import { describe, it, expect } from 'vitest';
import { readEnv } from './env';

const VALID = {
  VITE_SUPABASE_URL: 'https://mgpwjnxtqcnoyjgebytg.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'a'.repeat(40),
};

describe('readEnv', () => {
  it('accepts a well-formed environment', () => {
    const result = readEnv(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.VITE_SUPABASE_URL).toBe(VALID.VITE_SUPABASE_URL);
    }
  });

  it('reports the key name for a missing variable', () => {
    const result = readEnv({ VITE_SUPABASE_ANON_KEY: VALID.VITE_SUPABASE_ANON_KEY });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.key)).toContain('VITE_SUPABASE_URL');
    }
  });

  it('rejects a URL that is not a URL', () => {
    const result = readEnv({ ...VALID, VITE_SUPABASE_URL: 'mgpwjnxtqcnoyjgebytg' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].message).toMatch(/full URL/i);
    }
  });

  it('rejects a truncated anon key', () => {
    const result = readEnv({ ...VALID, VITE_SUPABASE_ANON_KEY: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].key).toBe('VITE_SUPABASE_ANON_KEY');
    }
  });

  it('reports every problem at once rather than the first', () => {
    const result = readEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toHaveLength(2);
  });

  describe('anon key role', () => {
    // Real-shaped Supabase JWTs (fake signatures). The signature is irrelevant —
    // the check reads the self-declared `role` claim, which is exactly the field
    // that differs between the two keys sitting side by side in the dashboard.
    const ANON_JWT =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncHdqbnh0cWNub3lqZ2VieXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.fakesignaturefakesignature';
    const SERVICE_ROLE_JWT =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncHdqbnh0cWNub3lqZ2VieXRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.fakesignaturefakesignature';

    it('accepts a real anon JWT', () => {
      expect(readEnv({ ...VALID, VITE_SUPABASE_ANON_KEY: ANON_JWT }).ok).toBe(true);
    });

    it('rejects a service_role JWT — it would bypass every RLS policy', () => {
      const result = readEnv({ ...VALID, VITE_SUPABASE_ANON_KEY: SERVICE_ROLE_JWT });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].key).toBe('VITE_SUPABASE_ANON_KEY');
        expect(result.issues[0].message).toMatch(/service_role/);
      }
    });

    it('rejects any non-anon role, not just service_role', () => {
      // { role: 'authenticated' } — same shape, still not browser-safe.
      const key =
        'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.fakesignaturefakesignature';
      expect(readEnv({ ...VALID, VITE_SUPABASE_ANON_KEY: key }).ok).toBe(false);
    });

    it('rejects a current-format secret key by prefix', () => {
      const result = readEnv({
        ...VALID,
        VITE_SUPABASE_ANON_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz012345',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0].message).toMatch(/secret/i);
    });

    it('accepts a current-format publishable key', () => {
      expect(
        readEnv({
          ...VALID,
          VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz012345',
        }).ok,
      ).toBe(true);
    });

    it('accepts an opaque key it cannot decode rather than guessing', () => {
      // Not a JWT and not a prefixed key: no evidence either way, and failing
      // shut here would brick legitimate custom setups.
      expect(readEnv({ ...VALID, VITE_SUPABASE_ANON_KEY: 'a'.repeat(40) }).ok).toBe(true);
    });

    it('does not mistake a malformed JWT payload for a bad role', () => {
      expect(
        readEnv({ ...VALID, VITE_SUPABASE_ANON_KEY: 'not.valid-base64!!.sig-padding-here' }).ok,
      ).toBe(true);
    });
  });

  describe('URL scheme', () => {
    it('rejects plain http for a remote host', () => {
      const result = readEnv({
        ...VALID,
        VITE_SUPABASE_URL: 'http://mgpwjnxtqcnoyjgebytg.supabase.co',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0].key).toBe('VITE_SUPABASE_URL');
    });

    it('allows http on localhost, where `supabase start` serves the local stack', () => {
      expect(readEnv({ ...VALID, VITE_SUPABASE_URL: 'http://localhost:54321' }).ok).toBe(true);
      expect(readEnv({ ...VALID, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).ok).toBe(true);
    });

    it('rejects a non-http protocol outright', () => {
      expect(readEnv({ ...VALID, VITE_SUPABASE_URL: 'ftp://example.com' }).ok).toBe(false);
    });
  });
});
