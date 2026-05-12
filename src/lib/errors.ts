import { isApiError } from './api';

// Translate raw Supabase/PostgREST error messages to friendly UI copy.
function friendlySupabaseMessage(raw: string): string {
  if (/duplicate key value violates unique constraint/i.test(raw))
    return 'This record already exists. Please use a unique value.';
  if (/new row violates row-level security policy/i.test(raw))
    return "You don't have permission to perform this action.";
  if (/update or delete on table.+violates foreign key constraint/i.test(raw))
    return 'Cannot delete this record because other records depend on it.';
  if (/insert or update on table.+violates foreign key constraint/i.test(raw))
    return 'Cannot save: a linked record was not found.';
  if (/null value in column.+violates not-null constraint/i.test(raw))
    return 'A required field is missing.';
  if (/value too long for type character varying/i.test(raw))
    return 'One of the fields exceeds the maximum allowed length.';
  if (/JWT expired/i.test(raw) || /PGRST301/i.test(raw))
    return 'Your session has expired. Please sign in again.';
  if (/permission denied/i.test(raw) || /42501/.test(raw))
    return "You don't have permission to perform this action.";
  return raw;
}

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (isApiError(error)) {
    return friendlySupabaseMessage(error.message) || fallback;
  }

  if (error instanceof Error && error.message) {
    return friendlySupabaseMessage(error.message);
  }

  return fallback;
};

export const getErrorDetails = (error: unknown) => {
  if (!isApiError(error)) return [];

  const { details } = error;
  if (!details) return [];

  if (Array.isArray(details)) {
    return details.map((detail) => {
      if (typeof detail === 'string') return detail;
      if (detail && typeof detail === 'object') {
        const field = 'field' in detail && detail.field ? `${detail.field}: ` : '';
        const message = 'message' in detail && detail.message ? detail.message : 'Invalid value';
        return `${field}${message}`;
      }
      return String(detail);
    });
  }

  if (typeof details === 'object') {
    return [JSON.stringify(details)];
  }

  return [String(details)];
};

export const getErrorRequestId = (error: unknown) => {
  if (isApiError(error) && error.requestId) {
    return error.requestId;
  }
  return null;
};
