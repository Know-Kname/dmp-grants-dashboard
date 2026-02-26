/**
 * Custom Form Hook with Zod Validation
 * Provides form state management with real-time validation
 */

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

interface UseFormOptions<T> {
  /** Zod schema for validation */
  schema: z.ZodSchema<T>;
  /** Initial form values */
  initialValues: T;
  /** Callback when form is submitted successfully */
  onSubmit: (data: T) => void | Promise<void>;
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

export function useForm<T extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouchedState] = useState<Partial<Record<keyof T, boolean>>>({});
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
  const validateField = useCallback((field: keyof T): boolean => {
    try {
      // Create a partial schema for just this field
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const fieldSchema = shape?.[field as string] as z.ZodTypeAny | undefined;
      if (fieldSchema) {
        fieldSchema.parse(values[field]);
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
        return true;
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [field]: error.issues[0]?.message || 'Invalid value',
        }));
        return false;
      }
      return true;
    }
  }, [schema, values]);

  // Validate entire form
  const validate = useCallback((): boolean => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }

    const newErrors: Partial<Record<keyof T, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof T;
      if (!newErrors[field]) {
        newErrors[field] = issue.message;
      }
    }
    setErrors(newErrors);
    return false;
  }, [schema, values]);

  // Set a single value
  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
    if (validateOnChange) {
      // Validate after state update
      setTimeout(() => validateField(field), 0);
    }
  }, [validateOnChange, validateField]);

  // Set multiple values
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  // Set touched state
  const setTouched = useCallback((field: keyof T) => {
    setTouchedState((prev) => ({ ...prev, [field]: true }));
    if (validateOnBlur) {
      validateField(field);
    }
  }, [validateOnBlur, validateField]);

  // Set error
  const setError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  // Clear error
  const clearError = useCallback((field: keyof T) => {
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
  const reset = useCallback((newValues?: T) => {
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
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    for (const key of Object.keys(values)) {
      allTouched[key as keyof T] = true;
    }
    setTouchedState(allTouched);

    // Validate
    const result = schema.safeParse(values);
    if (!result.success) {
      const newErrors: Partial<Record<keyof T, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof T;
        if (!newErrors[field]) {
          newErrors[field] = issue.message;
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
  const getFieldProps = useCallback(<K extends keyof T>(field: K) => ({
    name: field,
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setValue(field, value as T[K]);
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
 * Get error message for a field (only if touched)
 */
export function getFieldError<T>(
  field: keyof T,
  errors: Partial<Record<keyof T, string>>,
  touched: Partial<Record<keyof T, boolean>>
): string | undefined {
  return touched[field] ? errors[field] : undefined;
}
