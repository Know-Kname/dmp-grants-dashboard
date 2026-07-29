/**
 * Error types for the DMP CMS.
 *
 * The HTTP client (api.get/post/put/delete) and authApi that lived here previously
 * targeted a non-existent Express backend and have been removed. All data access
 * is now Supabase-direct via src/hooks/useData.ts. Auth lives in src/lib/auth.tsx.
 *
 * What survives is only what is actually reachable: query.tsx uses `isApiError`
 * plus the status predicates for retry decisions, errors.ts builds user-facing
 * messages from `ApiRequestError`, and the tests construct it directly.
 *
 * `NetworkError` and `TimeoutError` were removed with the HTTP client that threw
 * them. Nothing constructed either one, so `isNetworkError` was permanently
 * false and the "retry network errors up to 3 times" branch in query.tsx could
 * never run — Supabase failures surface as plain `Error` and always took the
 * default path. Deleting them changes no behaviour; it just stops the code from
 * implying a retry policy that was never in effect.
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

  isAuthError(): boolean {
    return this.statusCode === 401 || this.code === 'UNAUTHORIZED';
  }

  isValidationError(): boolean {
    return this.statusCode === 400 || this.code === 'VALIDATION_ERROR';
  }

  isNotFound(): boolean {
    return this.statusCode === 404 || this.code === 'NOT_FOUND';
  }
}

export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}
