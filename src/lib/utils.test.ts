import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateForInput,
  formatStatus,
  toCamelCaseKeys,
  toSnakeCaseKeys,
} from './utils';

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

  it('transforms keys inside arrays of objects', () => {
    const input = { lineItems: [{ unitPrice: 10 }, { unitPrice: 20 }] };
    expect(toSnakeCaseKeys(input)).toEqual({
      line_items: [{ unit_price: 10 }, { unit_price: 20 }],
    });
  });

  it('preserves Date instances rather than recursing into them', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const result = toSnakeCaseKeys({ createdAt: date }) as { created_at: Date };
    expect(result.created_at).toBe(date);
  });

  it('does not infinitely recurse on circular references', () => {
    const node: Record<string, unknown> = { firstName: 'Ada' };
    node.selfRef = node;

    // Without cycle detection this throws a RangeError (stack overflow).
    expect(() => toSnakeCaseKeys(node)).not.toThrow();
    const result = toSnakeCaseKeys(node) as Record<string, unknown>;
    expect(result.first_name).toBe('Ada');
    expect('self_ref' in result).toBe(true);
  });

  it('formats currency and status', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatStatus('in_progress')).toBe('In Progress');
  });
});

// These run with TZ pinned to America/Detroit (see vite.config.ts) so the
// negative-UTC-offset edge cases are actually exercised rather than accidentally
// passing on a UTC machine.
describe('date formatting across timezones', () => {
  it('keeps a late-evening timestamp on its own calendar day', () => {
    // 11:30pm local. Converting to UTC first rolls this onto the next day,
    // which is what the old toISOString() implementation did.
    const lateEvening = new Date(2026, 6, 29, 23, 30);
    expect(formatDateForInput(lateEvening)).toBe('2026-07-29');
  });

  it('round-trips a bare YYYY-MM-DD string unchanged', () => {
    // `new Date('2026-07-29')` parses as UTC midnight, i.e. the evening of the
    // 28th locally, so a naive local-getter implementation loses a day here.
    expect(formatDateForInput('2026-07-29')).toBe('2026-07-29');
  });

  it('displays a bare YYYY-MM-DD string as the same calendar day', () => {
    expect(formatDate('2026-07-29')).toBe('Jul 29, 2026');
  });

  it('preserves the calendar day of a full local timestamp', () => {
    expect(formatDateForInput('2026-07-29T23:30:00')).toBe('2026-07-29');
    expect(formatDate('2026-07-29T23:30:00')).toBe('Jul 29, 2026');
  });

  it('returns an empty string for missing or unparseable input', () => {
    expect(formatDateForInput(null)).toBe('');
    expect(formatDateForInput(undefined)).toBe('');
    expect(formatDateForInput('')).toBe('');
    expect(formatDateForInput('not-a-date')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});
