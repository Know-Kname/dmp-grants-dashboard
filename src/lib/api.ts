/**
 * Error class hierarchy for the DMP CMS.
 *
 * The HTTP client (api.get/post/put/delete) and authApi that lived here previously
 * targeted a non-existent Express backend and have been removed. All data access
 * is now Supabase-direct via src/hooks/useData.ts. Auth lives in src/lib/auth.tsx.
 *
 * This file now exports only the error types that propagate through the rest of
 * the codebase: query.tsx uses isApiError/isNetworkError for retry decisions,
 * errors.ts builds user-friendly messages from ApiRequestError, and tests
 * construct ApiRequestError instances directly.
 */

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class ApiRequestError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;
  public readonly isApiError = true;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.statusCode = error.statusCode;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
  }

  is(code: string): boolean {
    return this.code === code;
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.code === 'UNAUTHORIZED';
  }

  isValidationError(): boolean {
    return this.statusCode === 400 || this.code === 'VALIDATION_ERROR';
  }

  isNotFound(): boolean {
    return this.statusCode === 404 || this.code === 'NOT_FOUND';
  }

  isConflict(): boolean {
    return this.statusCode === 409 || this.code === 'CONFLICT';
  }
}

export class NetworkError extends Error {
  public readonly isNetworkError = true;

  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  public readonly isTimeoutError = true;

  constructor(message: string = 'Request timed out. Please try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
