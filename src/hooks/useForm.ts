/**
 * Custom Form Hook with Zod Validation
 * Provides form state management with real-time validation
 */

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

interface UseFormOptions<TValues, TParsed> {
  /** Zod schema for validation */
  schema: z.ZodType<TParsed, z.ZodTypeDef, TValues>;
  /** Initial form values */
  initialValues: TValues;
  /** Callback when the form is submitted and parses successfully */
  onSubmit: (data: TParsed) => void | Promise<void>;
  /** Validate on change (default: false) */
  validateOnChange?: boolean;
  /** Validate on blur (default: true) */
  validateOnBlur?: boolean;
}

interface UseFormReturn<T> {
  /** Current form values */
  values: T;
  /** Validation errors by field */
  errors: Partial<Record<keyof T, string>>;
  /** Fields that have been touched */
  touched: Partial<Record<keyof T, boolean>>;
  /** Whether form is currently submitting */
  isSubmitting: boolean;
  /** Whether form has been modified */
  isDirty: boolean;
  /** Whether form is valid */
  isValid: boolean;
  /** Update a single field value */
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Update multiple field values */
  setValues: (values: Partial<T>) => void;
  /** Set a field as touched */
  setTouched: (field: keyof T) => void;
  /** Set an error for a field */
  setError: (field: keyof T, error: string) => void;
  /** Clear error for a field */
  clearError: (field: keyof T) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Reset form to initial values */
  reset: (newValues?: T) => void;
  /** Handle form submission */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  /** Get props for an input field */
  getFieldProps: <K extends keyof T>(field: K) => {
    name: K;
    value: T[K];
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
  };
  /** Validate a single field */
  validateField: (field: keyof T) => boolean;
  /** Validate entire form */
  validate: () => boolean;
}

/**
 * Reach the per-field schema inside a form schema, if one is reachable.
 *
 * `.refine()` and `.transform()` wrap their subject in a `ZodEffects`, which has
 * no `.shape` — `resetPasswordFormSchema` is exactly that. The previous
 * implementation cast straight to `ZodObject` and read `.shape[field]`, which
 * was `undefined` for those schemas, so per-field validation silently did
 * nothing. Unwrapping reaches the object underneath.
 *
 * @returns The field's schema, or `null` when there is no per-field schema to
 *          isolate (the caller then falls back to whole-form validation).
 */
function fieldSchemaFor(schema: z.ZodTypeAny, field: string): z.ZodTypeAny | null {
  let current: z.ZodTypeAny = schema;
  while (current instanceof z.ZodEffects) {
    current = current.innerType();
  }
  return current instanceof z.ZodObject
    ? ((current.shape as z.ZodRawShape)[field] ?? null)
    : null;
}

/**
 * Controlled form state with Zod validation.
 *
 * Two type parameters, not one, because several schemas in `lib/schemas.ts`
 * coerce their fields — `amount`, `quantity` and `unitPrice` are declared as
 * `z.union([z.string().transform(Number), z.number()])`. For those the value the
 * form *holds* (a string, straight out of an `<input>`) and the value the schema
 * *produces* (a number) are different types. Collapsing both into one parameter
 * made `values` claim to be the parsed shape while actually holding raw strings.
 *
 * @typeParam TValues Shape of the live form state — the schema's input type.
 * @typeParam TParsed Shape handed to `onSubmit` — the schema's output type.
 */
export function useForm<TValues extends Record<string, unknown>, TParsed = TValues>({
  schema,
  initialValues,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<TValues, TParsed>): UseFormReturn<TValues> {
  const [values, setValuesState] = useState<TValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof TValues, string>>>({});
  const [touched, setTouchedState] = useState<Partial<Record<keyof TValues, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialValuesRef] = useState(initialValues);

  // Check if form has been modified
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValuesRef);
  }, [values, initialValuesRef]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Validate a single field
  const validateField = useCallback((field: keyof TValues): boolean => {
    const fieldSchema = fieldSchemaFor(schema, field as string);

    // No per-field schema reachable (e.g. a top-level .refine(), which is a
    // cross-field rule and cannot be judged from one value). Validating the
    // whole form and reading off this field's error is the honest fallback --
    // the previous code silently returned true here, so those fields were never
    // validated at all.
    if (!fieldSchema) {
      const result = schema.safeParse(values);
      const message = result.success
        ? undefined
        : result.error.errors.find((e) => e.path[0] === field)?.message;

      setErrors((prev) => {
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
      return !message;
    }

    const result = fieldSchema.safeParse(values[field]);
    setErrors((prev) => {
      const next = { ...prev };
      if (result.success) delete next[field];
      else next[field] = result.error.errors[0]?.message || 'Invalid value';
      return next;
    });
    return result.success;
  }, [schema, values]);

  // Validate entire form
  const validate = useCallback((): boolean => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }

    const newErrors: Partial<Record<keyof TValues, string>> = {};
    for (const error of result.error.errors) {
      const field = error.path[0] as keyof TValues;
      if (!newErrors[field]) {
        newErrors[field] = error.message;
      }
    }
    setErrors(newErrors);
    return false;
  }, [schema, values]);

  // Set a single value
  const setValue = useCallback(<K extends keyof TValues>(field: K, value: TValues[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
    if (validateOnChange) {
      // Validate after state update
      setTimeout(() => validateField(field), 0);
    }
  }, [validateOnChange, validateField]);

  // Set multiple values
  const setValues = useCallback((newValues: Partial<TValues>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  // Set touched state
  const setTouched = useCallback((field: keyof TValues) => {
    setTouchedState((prev) => ({ ...prev, [field]: true }));
    if (validateOnBlur) {
      validateField(field);
    }
  }, [validateOnBlur, validateField]);

  // Set error
  const setError = useCallback((field: keyof TValues, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  // Clear error
  const clearError = useCallback((field: keyof TValues) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Reset form
  const reset = useCallback((newValues?: TValues) => {
    setValuesState(newValues || initialValues);
    setErrors({});
    setTouchedState({});
  }, [initialValues]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Mark all fields as touched
    const allTouched: Partial<Record<keyof TValues, boolean>> = {};
    for (const key of Object.keys(values)) {
      allTouched[key as keyof TValues] = true;
    }
    setTouchedState(allTouched);

    // Validate
    const result = schema.safeParse(values);
    if (!result.success) {
      const newErrors: Partial<Record<keyof TValues, string>> = {};
      for (const error of result.error.errors) {
        const field = error.path[0] as keyof TValues;
        if (!newErrors[field]) {
          newErrors[field] = error.message;
        }
      }
      setErrors(newErrors);
      return;
    }

    // Submit
    setIsSubmitting(true);
    try {
      await onSubmit(result.data);
    } finally {
      setIsSubmitting(false);
    }
  }, [schema, values, onSubmit]);

  // Get field props for easy binding
  const getFieldProps = useCallback(<K extends keyof TValues>(field: K) => ({
    name: field,
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setValue(field, value as TValues[K]);
    },
    onBlur: () => setTouched(field),
  }), [values, setValue, setTouched]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    setValue,
    setValues,
    setTouched,
    setError,
    clearError,
    clearErrors,
    reset,
    handleSubmit,
    getFieldProps,
    validateField,
    validate,
  };
}

// ============================================
// FIELD ERROR COMPONENT HELPER
// ============================================

/**
 * Error message for a field, but only once the user has touched it — so a fresh
 * form doesn't open covered in complaints about fields nobody has filled yet.
 *
 * @returns The message, or `undefined` while the field is untouched or valid.
 */
export function getFieldError<T>(
  field: keyof T,
  errors: Partial<Record<keyof T, string>>,
  touched: Partial<Record<keyof T, boolean>>
): string | undefined {
  return touched[field] ? errors[field] : undefined;
}
