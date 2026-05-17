// ============================================
// CASE TRANSFORMATION UTILITIES
// ============================================

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toSnakeCaseKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => toSnakeCaseKeys(item)) as T;
  if (obj instanceof Date) return obj as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toSnakeCase(key)] = toSnakeCaseKeys(value);
    }
    return result as T;
  }
  return obj;
}

export function toCamelCaseKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => toCamelCaseKeys(item)) as T;
  if (obj instanceof Date) return obj as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamelCase(key)] = toCamelCaseKeys(value);
    }
    return result as T;
  }
  return obj;
}

// ============================================
// DATE UTILITIES
// ============================================

// Postgres `date` columns arrive as "YYYY-MM-DD". Appending "T00:00:00" forces
// local-midnight parsing and prevents UTC-to-local timezone shift.
export function parseDateStr(date: Date | string): Date {
  if (typeof date !== 'string') return date;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date(date);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  return parseDateStr(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = parseDateStr(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// ============================================
// STRING UTILITIES
// ============================================

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatStatus(status: string): string {
  if (!status) return '';
  return status.split('_').map((word) => capitalize(word)).join(' ');
}

// ============================================
// TYPE GUARDS
// ============================================

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================
// DEBOUNCE
// ============================================

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { func.apply(this, args); }, wait);
  };
}

// ============================================
// CLASS NAME UTILITY
// ============================================

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
