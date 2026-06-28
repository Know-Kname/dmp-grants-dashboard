import { describe, expect, it } from 'vitest';
import { formatCurrency, formatStatus, toCamelCaseKeys, toSnakeCaseKeys } from './utils';

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
