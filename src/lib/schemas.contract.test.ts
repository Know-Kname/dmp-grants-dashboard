import { describe, expect, it } from 'vitest';
import { contractFormSchema } from './schemas';

/**
 * Regression tests for the contract form schema.
 *
 * A contract can be priced two ways: a total typed straight into "Total Amount",
 * or a set of line items whose amounts are summed. Line items live in their own
 * React state inside `Contracts.tsx` — the schema cannot see them — so the
 * schema's job is only to *permit* a blank total. The "a total OR at least one
 * line item" rule is enforced by the page, which is the only place that knows
 * about both halves.
 *
 * Before the fix, `totalAmount` was
 *   z.union([z.string().transform(parseFloat), z.number()]).pipe(positiveNumberSchema)
 * where `''` became `parseFloat('') === NaN` and the pipe rejected it. That
 * rejection happened inside `useForm.handleSubmit`'s gate, upstream of the page's
 * line-item substitution, so "Create Contract" became a silent no-op.
 */

const validBase = {
  contractNumber: 'C-1',
  type: 'pre_need' as const,
  customerId: '3f9a1c72-58a1-4f3e-9b2c-0d1e2f3a4b5c',
  signedDate: '2026-01-01',
  status: 'active' as const,
};

describe('contractFormSchema — totalAmount', () => {
  it('accepts a contract priced entirely by line items (blank total)', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: '' });
    expect(result.success).toBe(true);
  });

  it('leaves a blank total undefined so the page can substitute the line-item sum', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: '' });
    expect(result.success && result.data.totalAmount).toBeUndefined();
  });

  it('still parses a typed total from the number input', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: '1500.50' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.totalAmount).toBe(1500.5);
  });

  it('still accepts an already-numeric total', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: 2000 });
    expect(result.success && result.data.totalAmount).toBe(2000);
  });

  it('accepts a zero total', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: '0' });
    expect(result.success && result.data.totalAmount).toBe(0);
  });

  it('rejects a negative total', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: '-5' });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.errors[0]?.path).toEqual(['totalAmount']);
  });

  it('rejects a non-numeric total with a readable message', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: 'abc' });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.errors[0]?.message)
      .toMatch(/valid amount/i);
  });

  it('still enforces the other required fields', () => {
    const result = contractFormSchema.safeParse({ ...validBase, totalAmount: '', contractNumber: '' });
    expect(result.success).toBe(false);
  });
});
