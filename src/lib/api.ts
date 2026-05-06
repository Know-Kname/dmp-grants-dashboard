/**
 * Type-Safe API Client for DMP Cemetery Management System
 * Features:
 * - Automatic snake_case <-> camelCase transformation
 * - Comprehensive error handling
 * - Type-safe responses
 * - Request/response interceptors
 * - Automatic token refresh handling
 *
 * NOTE: api.auth.login / register / logout are DEAD CODE — they call a non-existent
 * Express backend. Real auth lives in src/lib/auth.tsx via Supabase signInWithPassword
 * and signInWithOAuth. Do not use or expand the api.auth methods.
 */

import { toCamelCaseKeys, toSnakeCaseKeys } from './utils';

// ============================================
// TYPES
// ============================================

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: true;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  statusCode: number;
  requestId?: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface RequestConfig {
  /** Skip automatic camelCase transformation of response */
  skipCamelCase?: boolean;
  /** Skip automatic snake_case transformation of request body */
  skipSnakeCase?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request timeout in ms */
  timeout?: number;
  /** Signal for request cancellation */
  signal?: AbortSignal;
}

// ============================================
// ERROR CLASSES
// ============================================

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

  /** Check if error is a specific type */
  is(code: string): boolean {
    return this.code === code;
  }

  /** Check if error is authentication related */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.code === 'UNAUTHORIZED';
  }

  /** Check if error is validation related */
  isValidationError(): boolean {
    return this.statusCode === 400 || this.code === 'VALIDATION_ERROR';
  }

  /** Check if error is not found */
  isNotFound(): boolean {
    return this.statusCode === 404 || this.code === 'NOT_FOUND';
  }

  /** Check if error is a conflict (duplicate) */
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

// ============================================
// API CLIENT
// ============================================

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Get authentication headers
 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.pathname + url.search;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response, config: RequestConfig = {}): Promise<T> {
  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      throw new ApiRequestError({
        message: `Server error: ${response.statusText}`,
        code: 'SERVER_ERROR',
        statusCode: response.status,
      });
    }
    return {} as T;
  }

  const json = await response.json();

  // Check for error response format from our backend
  if (json.success === false && json.error) {
    const error = json.error;
    throw new ApiRequestError({
      message: error.message || 'An error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      statusCode: json.statusCode || response.status,
      details: error.details,
      requestId: json.requestId,
    });
  }

  // Handle HTTP error status codes
  if (!response.ok) {
    throw new ApiRequestError({
      message: json.message || json.error || `Request failed with status ${response.status}`,
      code: json.code || 'REQUEST_FAILED',
      statusCode: response.status,
      details: json.details,
    });
  }

  // Transform response keys from snake_case to camelCase
  if (!config.skipCamelCase) {
    // If response is an array, transform each item
    if (Array.isArray(json)) {
      return json.map((item) => toCamelCaseKeys(item)) as T;
    }
    // If response has a data property, transform it
    if (json.data !== undefined) {
      return {
        ...json,
        data: Array.isArray(json.data)
          ? json.data.map((item: unknown) => toCamelCaseKeys(item))
          : toCamelCaseKeys(json.data),
      } as T;
    }
    // Otherwise transform the whole response
    return toCamelCaseKeys(json) as T;
  }

  return json as T;
}

/**
 * Make an API request with timeout and error handling
 */
async function request<T>(
  method: string,
  endpoint: string,
  data?: unknown,
  config: RequestConfig = {}
): Promise<T> {
  const { headers = {}, params, timeout = DEFAULT_TIMEOUT, signal, skipSnakeCase } = config;

  // Build URL with query params
  const url = buildUrl(endpoint, params);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combine signals if external signal provided
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...headers,
      },
      signal: combinedSignal,
    };

    // Add body for methods that support it
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      // Transform request body keys from camelCase to snake_case
      const transformedData = skipSnakeCase ? data : toSnakeCaseKeys(data);
      requestInit.body = JSON.stringify(transformedData);
    }

    const response = await fetch(url, requestInit);

    // Handle 401 Unauthorized - clear token and redirect
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Dispatch event for auth state change
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw new ApiRequestError({
        message: 'Session expired. Please log in again.',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    }

    return await handleResponse<T>(response, config);
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TimeoutError();
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError();
    }

    // Re-throw API errors
    if (error instanceof ApiRequestError) {
      throw error;
    }

    // Wrap unknown errors
    throw new NetworkError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// PUBLIC API
// ============================================

export const api = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, config?: RequestConfig): Promise<T> => {
    return request<T>('GET', endpoint, undefined, config);
  },

  /**
   * POST request
   */
  post: <T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> => {
    return request<T>('POST', endpoint, data, config);
  },

  /**
   * PUT request
   */
  put: <T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> => {
    return request<T>('PUT', endpoint, data, config);
  },

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> => {
    return request<T>('PATCH', endpoint, data, config);
  },

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, config?: RequestConfig): Promise<T> => {
    return request<T>('DELETE', endpoint, undefined, config);
  },
};

// ============================================
// AUTH API (special handling)
// ============================================

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const authApi = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    return await handleResponse<LoginResponse>(response);
  },

  /**
   * Register a new user
   */
  register: async (data: { email: string; password: string; name: string }): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSnakeCaseKeys(data)),
    });

    return await handleResponse<LoginResponse>(response);
  },

  /**
   * Logout (client-side only)
   */
  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (isNetworkError(error)) {
    return 'Unable to connect to server. Please check your internet connection.';
  }
  if (isTimeoutError(error)) {
    return 'Request timed out. Please try again.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
