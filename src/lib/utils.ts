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
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a string from snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transform object keys using the supplied key mapper.
 * Handles nested objects and arrays, preserves Date instances, and tracks
 * visited objects with a WeakSet so circular references don't recurse forever.
 */
function transformKeys<T>(obj: T, mapKey: (key: string) => string, seen: WeakSet<object>): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    if (seen.has(obj)) return obj;
    seen.add(obj);
    return obj.map((item) => transformKeys(item, mapKey, seen)) as T;
  }

  if (obj instanceof Date) {
    return obj as T;
  }

  if (typeof obj === 'object') {
    if (seen.has(obj as object)) return obj;
    seen.add(obj as object);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[mapKey(key)] = transformKeys(value, mapKey, seen);
    }
    return result as T;
  }

  return obj;
}

/**
 * Type-level mirror of {@link toSnakeCase}: rewrites a camelCase string literal
 * type to its snake_case form.
 *
 * A character is treated as a word boundary only when it is an uppercase letter,
 * i.e. when it differs from its own lowercase form. Digits and symbols are
 * uppercase-invariant, so they pass through untouched — matching the runtime
 * regex, which only rewrites `[A-Z]`.
 */
type SnakeCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Head extends Uppercase<Head>
    ? Head extends Lowercase<Head>
      ? `${Head}${SnakeCase<Tail>}`
      : `_${Lowercase<Head>}${SnakeCase<Tail>}`
    : `${Head}${SnakeCase<Tail>}`
  : S;

/**
 * Applies {@link SnakeCase} to every key of `T`.
 *
 * Deliberately shallow. The runtime transform recurses, but every nested payload
 * this codebase sends (only `contracts.payment_plan`) is typed `Json` in the
 * schema, which accepts any shape — so recursing at the type level would add
 * complexity without adding a single check.
 */
export type SnakeCaseKeys<T> = {
  [K in keyof T as K extends string ? SnakeCase<K> : K]: T[K];
};

/**
 * Recursively convert object keys from camelCase to snake_case.
 * Handles nested objects and arrays.
 *
 * The return type is mapped rather than passed through as `T`, which is what
 * lets a transformed payload be checked against the generated database types.
 * Were this to return `T` (or were callers to widen the input to
 * `Record<string, unknown>` first), the result would collapse to an index
 * signature and Postgrest would accept any object at all — which is precisely
 * how an insert naming a nonexistent `created_by` column reached production.
 */
export function toSnakeCaseKeys<T>(obj: T): SnakeCaseKeys<T> {
  return transformKeys(obj, toSnakeCase, new WeakSet()) as SnakeCaseKeys<T>;
}

/**
 * Recursively convert object keys from snake_case to camelCase
 * Handles nested objects and arrays
 */
export function toCamelCaseKeys<T>(obj: T): T {
  return transformKeys(obj, toCamelCase, new WeakSet());
}

// ============================================
// DATE UTILITIES
// ============================================

/** Matches a bare calendar date with no time component, e.g. "2026-07-29". */
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date value into a `Date` that represents the intended *calendar day*
 * in the viewer's local timezone.
 *
 * Why this exists: `new Date('2026-07-29')` is specified to parse as UTC
 * midnight, which is the *previous* calendar day in every negative-offset
 * timezone — i.e. everywhere DMP operates. Date-only strings are therefore
 * built from their parts so the day survives; anything else (a full timestamp,
 * or an existing `Date`) is used as-is.
 *
 * @param date A `Date`, an ISO timestamp, or a bare `YYYY-MM-DD` string.
 * @returns A valid local `Date`, or `null` if the input could not be parsed.
 */
function parseLocalDate(date: Date | string): Date | null {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dateOnly = DATE_ONLY_PATTERN.exec(date);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(date);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date for display, e.g. "Jul 29, 2026".
 *
 * @returns The formatted date, or `''` if the input is missing or unparseable.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = parseLocalDate(date);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date for a native `<input type="date">`, which requires `YYYY-MM-DD`.
 *
 * Built from local getters rather than `toISOString()`: the latter converts to
 * UTC first, so any evening timestamp in a negative-offset timezone would
 * prefill the form with the *following* day.
 *
 * @returns The `YYYY-MM-DD` string, or `''` if the input is missing or unparseable.
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = parseLocalDate(date);
  if (!d) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
function capitalize(str: string): string {
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
 * Check if a value is a valid UUID
 */
export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
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
