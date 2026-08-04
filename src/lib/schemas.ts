/**
 * Zod Validation Schemas
 * Client-side validation for forms and API responses
 */

import { z } from 'zod';
import { APP_ROLES, type AppRole } from './permissions';

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
// USER ACCOUNT SCHEMAS
// ============================================

/**
 * The three values `profiles.role` may hold.
 *
 * Duplicating the union from `./permissions` would let the two drift, so this
 * is built from `APP_ROLES` and pinned to `AppRole` by `satisfies` below — a
 * fourth role added there is a compile error here until it is handled.
 */
export const appRoleSchema = z.enum(APP_ROLES, {
  errorMap: () => ({ message: 'Select a role' }),
}) satisfies z.ZodType<AppRole>;

/**
 * The admin form on `/users`.
 *
 * `isActive` is `'true' | 'false'` on the way in because it is bound to a
 * `<Select>`, which can only hold a string, and a boolean on the way out
 * because that is what the `is_active` column takes. Same reason `amount` is a
 * string-in/number-out union on the money forms — see `useForm`'s two type
 * parameters.
 */
export const userAccountFormSchema = z.object({
  role: appRoleSchema,
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export type UserAccountFormData = z.infer<typeof userAccountFormSchema>;

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

/**
 * Trimmed, unlike the shared `emailSchema`, because this address is nearly
 * always pasted — and a trailing space would otherwise fail `.email()` and read
 * as "your email is invalid" for an address that is perfectly correct.
 */
export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
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
// DASHBOARD RPC SCHEMAS
// ============================================

/**
 * A number as it may arrive from PostgREST.
 *
 * Postgres `numeric` has more range and precision than a JS double, so the
 * wire format for it is not guaranteed: inside a `jsonb` payload it is a JSON
 * number, but a `numeric` *column* is sometimes serialised as a string so no
 * precision is lost in transit. Both are accepted here and coerced once, at the
 * edge, rather than each call site guessing.
 *
 * `Number('')` is 0 and `Number(null)` is 0 — both would sail through an
 * unguarded coercion and put a fabricated zero on a financial KPI. Empty and
 * whitespace-only strings are therefore rejected outright, and anything else
 * that coerces to NaN or Infinity is rejected by the `finite` refinement.
 */
export const dbNumberSchema = z.union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : v.trim() === '' ? NaN : Number(v)))
  .refine((n) => Number.isFinite(n), 'Expected a finite number');

/** A count: a whole, non-negative `dbNumber`. */
export const dbCountSchema = dbNumberSchema.refine(
  (n) => Number.isInteger(n) && n >= 0,
  'Expected a non-negative whole number',
);

/**
 * One entry of `dashboard_summary()`'s `upcomingGrants` array.
 *
 * `amount` is nullable because `grants.amount` is; `daysLeft` is computed
 * server-side as `deadline - current_date` so the client never re-derives it
 * from a date string in the wrong timezone.
 */
export const upcomingGrantSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  amount: dbNumberSchema.nullable(),
  deadline: z.string(),
  status: z.string(),
  daysLeft: dbNumberSchema,
});

export type UpcomingGrant = z.infer<typeof upcomingGrantSchema>;

/** A `{name, n}` pair: one counselor, section, or similar ranked dimension. */
export const namedCountSchema = z.object({
  name: z.string(),
  n: dbCountSchema,
});

export type NamedCount = z.infer<typeof namedCountSchema>;

/** One referring funeral home, with its share of all referred interments. */
export const referralSchema = z.object({
  name: z.string(),
  n: dbCountSchema,
  pct: dbNumberSchema,
});

export type Referral = z.infer<typeof referralSchema>;

/** One vendor's known spend, for the spend ranking. */
export const vendorSpendSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  spend: dbNumberSchema,
});

export type VendorSpend = z.infer<typeof vendorSpendSchema>;

/**
 * Interment capacity.
 *
 * `runwayYears` is nullable and currently always null. Runway — available
 * spaces ÷ annual absorption — is the real cemetery capacity metric, but the
 * import only created graves that already hold an interment, so there is no
 * available-space denominator. `runwayReason` carries that explanation to the
 * UI so the card can say why rather than show a hyphen.
 *
 * Note what is deliberately absent: an occupancy percentage. Every grave here
 * is occupied, so it would read 100%, and high occupancy means *less left to
 * sell* — it is not a performance figure and must never be scored as one.
 */
export const capacitySchema = z.object({
  gravesTotal: dbCountSchema,
  gravesOccupied: dbCountSchema,
  lotsTotal: dbCountSchema,
  runwayYears: dbNumberSchema.nullable(),
  runwayReason: z.string().nullable(),
});

export type Capacity = z.infer<typeof capacitySchema>;

/**
 * The single `jsonb` object returned by the `dashboard_summary()` RPC.
 *
 * A jsonb blob off the network is `unknown`; parsing it once here is what lets
 * the rest of the dashboard work with real types instead of casts. Unknown keys
 * are stripped rather than rejected, so the database may grow a new KPI before
 * the client learns to render it.
 *
 * `workOrdersByStatus`, `inventoryByCategory`, `ageBands`, `intermentsByYear`
 * and `vendorSpendByCategory` omit keys with no rows — an absent key means
 * zero, not missing data.
 */
export const dashboardSummarySchema = z.object({
  generatedAt: z.string(),

  /**
   * The latest date that actually has data — the anchor every burial window
   * below resolves against. Null only when there are no burials at all, which
   * is what lets the UI distinguish "nothing loaded" from "loaded, and it ends
   * today".
   */
  dataAsOf: z.string().nullable(),

  // Anchored burial counters. These are what the page renders: with a purely
  // historical register the calendar-relative ones below are all zero, which is
  // true but useless.
  burialsLatestMonth: dbCountSchema,
  burialsPriorMonth: dbCountSchema,
  burialsTrailing12: dbCountSchema,
  totalInterments: dbCountSchema,
  intermentsByYear: z.record(z.string(), dbCountSchema),

  // Referral channel. Concentration here is the headline business fact, not the
  // per-home counts.
  topFuneralHomes: z.array(referralSchema),
  referralTop5Pct: dbNumberSchema.nullable(),
  distinctFuneralHomes: dbCountSchema,

  topCounselors: z.array(namedCountSchema),

  ageBands: z.record(z.string(), dbCountSchema),
  medianAgeAtDeath: dbNumberSchema.nullable(),

  sectionsInUse: dbCountSchema,
  topSections: z.array(namedCountSchema),

  capacity: capacitySchema,

  customerCount: dbCountSchema,

  vendorCount: dbCountSchema,
  vendorSpendKnown: dbNumberSchema,
  vendorSpendByCategory: z.record(z.string(), dbNumberSchema),
  topVendorsBySpend: z.array(vendorSpendSchema),

  /**
   * Calendar-relative counters, kept because the RPC still returns them and
   * removing a required field would break any client still deployed. The page
   * no longer reads them.
   */
  burialsThisMonth: dbCountSchema,
  burialsLastMonth: dbCountSchema,
  burialsYTD: dbCountSchema,

  /**
   * Unfiltered row counts for the modules whose data has not landed yet.
   *
   * These exist so the page can tell "this table is empty" from "this table is
   * full and every filtered figure in it is legitimately zero" — a business
   * that has collected every invoice has `unpaidAR === 0` with plenty of
   * receivables, and a deposit ledger imported from 2020 has `revenue30d === 0`
   * with thousands of rows. Gating a card on the filtered figure would call
   * both of those "not loaded".
   */
  totalContracts: dbCountSchema,
  totalAR: dbCountSchema,
  totalDeposits: dbCountSchema,

  activeContracts: dbCountSchema,
  contractsValue: dbNumberSchema,

  arOutstanding: dbNumberSchema,
  unpaidAR: dbCountSchema,
  overdueAR: dbCountSchema,

  apOutstanding: dbNumberSchema,

  activeWO: dbCountSchema,
  totalWO: dbCountSchema,

  lowStock: dbCountSchema,
  totalInventory: dbCountSchema,

  revenue30d: dbNumberSchema,
  revenuePrior30d: dbNumberSchema,

  workOrdersByStatus: z.record(z.string(), dbCountSchema),
  inventoryByCategory: z.record(z.string(), dbCountSchema),

  upcomingGrants: z.array(upcomingGrantSchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

/**
 * Rows from `monthly_burial_trend()` / `monthly_revenue_trend()`.
 *
 * These are set-returning functions, not jsonb, so their columns arrive in
 * snake_case — unlike the summary, which builds camelCase keys in SQL. They are
 * zero-filled and ordered ascending server-side.
 */
export const burialTrendRowSchema = z.object({
  month_start: z.string(),
  label: z.string(),
  burials: dbCountSchema,
});

export const revenueTrendRowSchema = z.object({
  month_start: z.string(),
  label: z.string(),
  revenue: dbNumberSchema,
});

export const burialTrendSchema = z.array(burialTrendRowSchema);
export const revenueTrendSchema = z.array(revenueTrendRowSchema);

export type BurialTrendRow = z.infer<typeof burialTrendRowSchema>;
export type RevenueTrendRow = z.infer<typeof revenueTrendRowSchema>;

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
