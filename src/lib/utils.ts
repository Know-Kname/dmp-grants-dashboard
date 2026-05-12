/**
 * Utility functions for the DMP application
 * Case transformation, type guards, and helpers
 */

// ============================================
// CASE TRANSFORMATION UTILITIES
// ============================================

/**
 * Convert a string from camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a string from snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively convert object keys from camelCase to snake_case
 * Handles nested objects and arrays
 */
export function toSnakeCaseKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCaseKeys(item)) as T;
  }

  if (obj instanceof Date) {
    return obj as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = toSnakeCaseKeys(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Recursively convert object keys from snake_case to camelCase
 * Handles nested objects and arrays
 */
export function toCamelCaseKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCaseKeys(item)) as T;
  }

  if (obj instanceof Date) {
    return obj as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = toCamelCaseKeys(value);
    }
    return result as T;
  }

  return obj;
}

// ============================================
// DATE UTILITIES
// ============================================

// Postgres `date` columns arrive as "YYYY-MM-DD" strings. Parsing them with
// `new Date("YYYY-MM-DD")` treats them as UTC midnight, which shifts the
// displayed date one day earlier in US/Eastern and other timezones behind UTC.
// Appending "T00:00:00" (no TZ suffix) forces local-midnight parsing.
export function parseDateStr(date: Date | string): Date {
  if (typeof date !== 'string') return date;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date(date);
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  return parseDateStr(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date for form inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = parseDateStr(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert status/type strings to display format
 * e.g., "in_progress" -> "In Progress"
 */
export function formatStatus(status: string): string {
  if (!status) return '';
  return status
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is a valid UUID
 */
export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================
// DEBOUNCE / THROTTLE
// ============================================

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// ============================================
// CLASS NAME UTILITIES
// ============================================

/**
 * Conditionally join class names
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
