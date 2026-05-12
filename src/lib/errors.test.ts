import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api';
import { getErrorDetails, getErrorMessage, getErrorRequestId } from './errors';

describe('error helpers', () => {
  it('extracts message and request id from ApiRequestError', () => {
    const error = new ApiRequestError({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      requestId: 'req-123',
    });

    expect(getErrorMessage(error)).toBe('Validation failed');
    expect(getErrorRequestId(error)).toBe('req-123');
  });

  it('formats validation details from ApiRequestError', () => {
    const error = new ApiRequestError({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: [
        { field: 'title', message: 'Title is required' },
        { field: 'amount', message: 'Amount must be positive' },
      ],
    });

    expect(getErrorDetails(error)).toEqual([
      'title: Title is required',
      'amount: Amount must be positive',
    ]);
  });

  it('falls back for non-API errors', () => {
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
    expect(getErrorDetails(new Error('Boom'))).toEqual([]);
    expect(getErrorRequestId(new Error('Boom'))).toBeNull();
  });

  it('translates raw Supabase messages to friendly copy', () => {
    const dup = new Error('duplicate key value violates unique constraint "contracts_pkey"');
    expect(getErrorMessage(dup)).toBe('This record already exists. Please use a unique value.');

    const rls = new Error('new row violates row-level security policy for table "burials"');
    expect(getErrorMessage(rls)).toBe("You don't have permission to perform this action.");

    const fk = new Error('insert or update on table "graves" violates foreign key constraint "graves_lot_id_fkey"');
    expect(getErrorMessage(fk)).toBe('Cannot save: a linked record was not found.');

    const jwt = new ApiRequestError({ message: 'JWT expired', code: 'PGRST301', statusCode: 401 });
    expect(getErrorMessage(jwt)).toBe('Your session has expired. Please sign in again.');
  });
});
