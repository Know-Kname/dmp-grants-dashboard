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
});
