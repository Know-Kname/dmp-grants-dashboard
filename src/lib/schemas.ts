/**
 * Zod Validation Schemas
 * Client-side validation for forms and API responses
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

/** UUID validation */
export const uuidSchema = z.string().uuid('Invalid ID format');

/** Email validation */
export const emailSchema = z.string().email('Invalid email address');

/** Phone number validation (flexible) */
export const phoneSchema = z.string()
  .regex(/^[\d\s+\-()]+$/, 'Invalid phone number format')
  .optional()
  .or(z.literal(''));

/** US ZIP code validation */
export const zipCodeSchema = z.string()
  .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
  .optional()
  .or(z.literal(''));

/** Date string validation (ISO format) */
export const dateStringSchema = z.string()
  .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format');

/** Positive number validation */
export const positiveNumberSchema = z.number()
  .min(0, 'Must be a positive number');

/** Non-negative integer validation */
export const nonNegativeIntSchema = z.number()
  .int('Must be a whole number')
  .min(0, 'Must be a non-negative number');

// ============================================
// WORK ORDER SCHEMAS
// ============================================

export const workOrderTypeSchema = z.enum(['maintenance', 'burial_prep', 'grounds', 'repair', 'other'], {
  errorMap: () => ({ message: 'Invalid work order type' }),
});

export const workOrderPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'], {
  errorMap: () => ({ message: 'Invalid priority level' }),
});

export const workOrderStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled'], {
  errorMap: () => ({ message: 'Invalid status' }),
});

export const workOrderFormSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be less than 255 characters'),
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional()
    .or(z.literal('')),
  type: workOrderTypeSchema,
  priority: workOrderPrioritySchema,
  status: workOrderStatusSchema.optional(),
  // A free-text staff name, not a foreign key. The form field is a plain text
  // input placeholdered "Staff name" and work_orders.assigned_to is a nullable
  // text column — this was declared as a uuid while nothing imported the schema,
  // so wiring it up unchanged would have rejected every real name entered.
  assignedTo: z.string().max(255, 'Assigned to must be less than 255 characters')
    .optional().or(z.literal('')),
  dueDate: dateStringSchema.optional().or(z.literal('')),
  completedDate: dateStringSchema.optional().or(z.literal('')),
});

export type WorkOrderFormData = z.infer<typeof workOrderFormSchema>;

// ============================================
// GRANT SCHEMAS
// ============================================

export const grantTypeSchema = z.enum(['grant', 'benefit', 'opportunity'], {
  errorMap: () => ({ message: 'Invalid grant type' }),
});

export const grantStatusSchema = z.enum(['available', 'applied', 'approved', 'denied', 'received'], {
  errorMap: () => ({ message: 'Invalid status' }),
});

export const grantFormSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be less than 255 characters'),
  description: z.string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .or(z.literal('')),
  type: grantTypeSchema,
  source: z.string()
    .min(2, 'Source must be at least 2 characters')
    .max(255, 'Source must be less than 255 characters'),
  amount: z.union([
    z.string().transform((val) => val === '' ? undefined : parseFloat(val)),
    z.number(),
  ]).optional().refine((val) => val === undefined || val >= 0, 'Amount must be positive'),
  deadline: dateStringSchema.optional().or(z.literal('')),
  status: grantStatusSchema,
  applicationDate: dateStringSchema.optional().or(z.literal('')),
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional().or(z.literal('')),
});

export type GrantFormData = z.infer<typeof grantFormSchema>;

// ============================================
// INVENTORY SCHEMAS
// ============================================

export const inventoryCategorySchema = z.enum(['casket', 'urn', 'vault', 'marker', 'supplies', 'other'], {
  errorMap: () => ({ message: 'Invalid category' }),
});

export const inventoryFormSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be less than 255 characters'),
  category: inventoryCategorySchema,
  sku: z.string().max(100, 'SKU must be less than 100 characters').optional().or(z.literal('')),
  quantity: z.union([
    z.string().transform((val) => parseInt(val, 10)),
    z.number(),
  ]).pipe(nonNegativeIntSchema),
  reorderPoint: z.union([
    z.string().transform((val) => parseInt(val, 10)),
    z.number(),
  ]).pipe(nonNegativeIntSchema),
  unitPrice: z.union([
    z.string().transform((val) => parseFloat(val)),
    z.number(),
  ]).pipe(positiveNumberSchema),
  vendorId: uuidSchema.optional().or(z.literal('')),
  location: z.string().max(255, 'Location must be less than 255 characters').optional().or(z.literal('')),
});

export type InventoryFormData = z.infer<typeof inventoryFormSchema>;

// ============================================
// CUSTOMER SCHEMAS
// ============================================

export const customerFormSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(255, 'First name must be less than 255 characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(255, 'Last name must be less than 255 characters'),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  address: z.string().max(500, 'Address must be less than 500 characters').optional().or(z.literal('')),
  city: z.string().max(100, 'City must be less than 100 characters').optional().or(z.literal('')),
  state: z.string().max(50, 'State must be less than 50 characters').optional().or(z.literal('')),
  zipCode: zipCodeSchema,
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional().or(z.literal('')),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

// ============================================
// VENDOR SCHEMAS
// ============================================

export const vendorFormSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be less than 255 characters'),
  contactName: z.string().max(255, 'Contact name must be less than 255 characters').optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  address: z.string().max(500, 'Address must be less than 500 characters').optional().or(z.literal('')),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional().or(z.literal('')),
});

export type VendorFormData = z.infer<typeof vendorFormSchema>;

// ============================================
// BURIAL SCHEMAS
// ============================================

export const burialFormSchema = z.object({
  deceasedFirstName: z.string()
    .min(1, 'First name is required')
    .max(255, 'First name must be less than 255 characters'),
  deceasedLastName: z.string()
    .min(1, 'Last name is required')
    .max(255, 'Last name must be less than 255 characters'),
  deceasedMiddleName: z.string().max(255).optional().or(z.literal('')),
  dateOfBirth: dateStringSchema.optional().or(z.literal('')),
  dateOfDeath: dateStringSchema.optional().or(z.literal('')),
  burialDate: z.string().min(1, 'Burial date is required').pipe(dateStringSchema),
  // plotLocation is deliberately absent: it is not an input. The page derives it
  // as `${section}-${lot}-${grave}` when building the payload, so requiring it
  // here would make a form that can never be valid.
  section: z.string().min(1, 'Section is required'),
  lot: z.string().min(1, 'Lot is required'),
  grave: z.string().min(1, 'Grave is required'),
  contactName: z.string().max(255).optional().or(z.literal('')),
  contactPhone: phoneSchema,
  contactEmail: emailSchema.optional().or(z.literal('')),
  permitNumber: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  /** Publishes the public QR memorial page; a checkbox on the form. */
  memorialPublished: z.boolean(),
});

export type BurialFormData = z.infer<typeof burialFormSchema>;

// ============================================
// CONTRACT SCHEMAS
// ============================================

export const contractTypeSchema = z.enum(['pre_need', 'at_need'], {
  errorMap: () => ({ message: 'Invalid contract type' }),
});

export const contractStatusSchema = z.enum(['active', 'paid', 'cancelled', 'transferred'], {
  errorMap: () => ({ message: 'Invalid status' }),
});

export const contractItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.union([
    z.string().transform((val) => parseFloat(val)),
    z.number(),
  ]).pipe(positiveNumberSchema),
});

export const paymentPlanSchema = z.object({
  frequency: z.enum(['weekly', 'bi_weekly', 'monthly', 'quarterly']),
  installmentAmount: positiveNumberSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema.optional(),
}).optional();

export const contractFormSchema = z.object({
  contractNumber: z.string().min(1, 'Contract number is required'),
  type: contractTypeSchema,
  customerId: uuidSchema,
  totalAmount: z.union([
    z.string().transform((val) => parseFloat(val)),
    z.number(),
  ]).pipe(positiveNumberSchema),
  signedDate: z.string().min(1, 'Signed date is required').pipe(dateStringSchema),
  status: contractStatusSchema,
  // paymentPlan and items are deliberately absent: neither is a field on this
  // form. The payment plan is rendered read-only, and line items are held in
  // their own state and merged into the payload at submit time (the total is
  // derived from them when present). `status` was missing despite being a real
  // field — none of this was noticed while the schema had no importers.
});

export type ContractFormData = z.infer<typeof contractFormSchema>;

// ============================================
// FINANCIAL SCHEMAS
// ============================================

export const paymentMethodSchema = z.enum(['cash', 'check', 'credit_card', 'wire', 'other'], {
  errorMap: () => ({ message: 'Invalid payment method' }),
});

export const financialStatusSchema = z.enum(['pending', 'partial', 'paid', 'overdue'], {
  errorMap: () => ({ message: 'Invalid status' }),
});

export const depositFormSchema = z.object({
  amount: z.union([
    z.string().transform((val) => parseFloat(val)),
    z.number(),
  ]).pipe(positiveNumberSchema),
  date: z.string().min(1, 'Date is required').pipe(dateStringSchema),
  method: paymentMethodSchema,
  reference: z.string().max(255).optional().or(z.literal('')),
  customerId: uuidSchema.optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export type DepositFormData = z.infer<typeof depositFormSchema>;

export const receivableFormSchema = z.object({
  customerId: uuidSchema,
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  amount: z.union([
    z.string().transform((val) => parseFloat(val)),
    z.number(),
  ]).pipe(positiveNumberSchema),
  dueDate: z.string().min(1, 'Due date is required').pipe(dateStringSchema),
});

export type ReceivableFormData = z.infer<typeof receivableFormSchema>;

export const payableFormSchema = z.object({
  vendorId: uuidSchema,
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  amount: z.union([
    z.string().transform((val) => parseFloat(val)),
    z.number(),
  ]).pipe(positiveNumberSchema),
  dueDate: z.string().min(1, 'Due date is required').pipe(dateStringSchema),
});

export type PayableFormData = z.infer<typeof payableFormSchema>;

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

export const forgotPasswordFormSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;

/**
 * 12 characters, matching the Supabase project's minimum. Validating it here as
 * well means the user gets the rule before submitting rather than as a server
 * error after. (There is no registration schema — accounts are invite-only.)
 */
export const resetPasswordFormSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate form data and return formatted errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const error of result.error.errors) {
    const path = error.path.join('.');
    if (!errors[path]) {
      errors[path] = error.message;
    }
  }

  return { success: false, errors };
}

/**
 * Get first error message from Zod error
 */
export function getFirstError(error: z.ZodError): string {
  return error.errors[0]?.message || 'Validation failed';
}

/**
 * Format Zod errors as a record of field -> message
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const err of error.errors) {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  }
  return errors;
}
