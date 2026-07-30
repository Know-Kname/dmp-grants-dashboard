import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { z } from 'zod';
import { getFieldError, useForm } from './useForm';

/**
 * These cover the two defects that made the validation layer unusable before it
 * was wired up. Both were silent: the code ran, reported success, and validated
 * nothing.
 */

// Mirrors resetPasswordFormSchema: a top-level .refine() makes this a ZodEffects,
// which has no `.shape` to look a field up in.
const refinedSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Mirrors grantFormSchema.amount: input is a string, output is a number.
const coercingSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  amount: z.union([z.string().transform((v) => parseFloat(v)), z.number()]),
});

describe('useForm', () => {
  it('validates a field inside a .refine()d schema', () => {
    // Previously validateField cast to ZodObject, read `.shape[field]` on a
    // ZodEffects, got undefined, and returned true without checking anything.
    const { result } = renderHook(() =>
      useForm({
        schema: refinedSchema,
        initialValues: { password: 'short', confirmPassword: 'short' },
        onSubmit: () => {},
      })
    );

    let valid = true;
    act(() => {
      valid = result.current.validateField('password');
    });

    expect(valid).toBe(false);
    expect(result.current.errors.password).toBe('Password must be at least 8 characters');
  });

  it('clears the error once a .refine()d schema field becomes valid', () => {
    const { result } = renderHook(() =>
      useForm({
        schema: refinedSchema,
        initialValues: { password: 'short', confirmPassword: 'short' },
        onSubmit: () => {},
      })
    );

    act(() => { result.current.validateField('password'); });
    expect(result.current.errors.password).toBeDefined();

    act(() => { result.current.setValue('password', 'longenoughpassword'); });
    act(() => { result.current.validateField('password'); });

    expect(result.current.errors.password).toBeUndefined();
  });

  it('holds raw input values but submits parsed output', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({
        schema: coercingSchema,
        initialValues: { label: 'Roof repair', amount: '1250.50' },
        onSubmit,
      })
    );

    // The form state is what the <input> gave us: a string.
    expect(result.current.values.amount).toBe('1250.50');

    await act(async () => { await result.current.handleSubmit(); });

    // ...but the submitted payload is the coerced number.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({ label: 'Roof repair', amount: 1250.5 });
  });

  it('does not submit when the schema rejects the input', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({
        schema: coercingSchema,
        initialValues: { label: '', amount: '10' },
        onSubmit,
      })
    );

    await act(async () => { await result.current.handleSubmit(); });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.label).toBe('Label is required');
  });

  it('reports a cross-field error against the field the schema blames', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({
        schema: refinedSchema,
        initialValues: { password: 'longenoughpassword', confirmPassword: 'different' },
        onSubmit,
      })
    );

    await act(async () => { await result.current.handleSubmit(); });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.confirmPassword).toBe('Passwords do not match');
  });
});

describe('getFieldError', () => {
  it('stays quiet until the field has been touched', () => {
    const errors = { title: 'Required' };
    expect(getFieldError('title', errors, {})).toBeUndefined();
    expect(getFieldError('title', errors, { title: true })).toBe('Required');
  });
});
