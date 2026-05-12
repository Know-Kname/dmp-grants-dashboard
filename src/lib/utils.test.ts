import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDateForInput, formatStatus, parseDateStr, toCamelCaseKeys, toSnakeCaseKeys } from './utils';

describe('utils', () => {
  it('converts object keys to snake_case', () => {
    const input = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      addressInfo: { zipCode: '12345' },
    };

    expect(toSnakeCaseKeys(input)).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      address_info: { zip_code: '12345' },
    });
  });

  it('converts object keys to camelCase', () => {
    const input = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      address_info: { zip_code: '12345' },
    };

    expect(toCamelCaseKeys(input)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      addressInfo: { zipCode: '12345' },
    });
  });

  it('formats currency and status', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatStatus('in_progress')).toBe('In Progress');
  });

  it('formatDateForInput round-trips a Postgres date string without timezone shift', () => {
    // "YYYY-MM-DD" from Postgres must not shift to the previous day in US timezones.
    expect(formatDateForInput('2026-05-12')).toBe('2026-05-12');
    expect(formatDateForInput('2026-01-01')).toBe('2026-01-01');
    expect(formatDateForInput('2026-12-31')).toBe('2026-12-31');
  });

  it('formatDate displays correct calendar day for Postgres date strings', () => {
    // Only test the day/month portion to stay timezone-independent.
    expect(formatDate('2026-05-12')).toContain('12');
    expect(formatDate('2026-05-12')).toContain('2026');
  });

  it('parseDateStr preserves the same calendar day for date-only strings', () => {
    const d = parseDateStr('2026-05-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-indexed May
    expect(d.getDate()).toBe(12);
  });

  it('parseDateStr passes Date objects through unchanged', () => {
    const original = new Date(2026, 4, 12, 10, 30);
    expect(parseDateStr(original)).toBe(original);
  });
});
