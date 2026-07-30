import { describe, it, expect } from 'vitest';
import { fuzzyScore } from './fuzzy';

describe('fuzzyScore', () => {
  it('matches exact substrings with a high score', () => {
    expect(fuzzyScore('work', 'Work Orders')).not.toBeNull();
    expect(fuzzyScore('work', 'Work Orders')!).toBeGreaterThan(50);
  });

  it('matches subsequences in order', () => {
    expect(fuzzyScore('wo', 'Work Orders')).not.toBeNull();
    expect(fuzzyScore('cst', 'Customers')).not.toBeNull();
  });

  it('returns null when characters are missing or out of order', () => {
    expect(fuzzyScore('xyz', 'Work Orders')).toBeNull();
    expect(fuzzyScore('ow', 'wo')).toBeNull();
  });

  it('ranks word-boundary matches above scattered ones', () => {
    const boundary = fuzzyScore('wo', 'Work Orders')!;
    const scattered = fuzzyScore('wo', 'brown fox')!;
    expect(boundary).toBeGreaterThan(scattered);
  });

  it('is case-insensitive and matches empty query', () => {
    expect(fuzzyScore('GRANTS', 'grants')).not.toBeNull();
    expect(fuzzyScore('', 'anything')).toBe(0);
  });
});
