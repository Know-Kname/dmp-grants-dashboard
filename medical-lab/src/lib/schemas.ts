import { z } from 'zod';

// ============================================
// PRIMITIVE SCHEMAS
// ============================================

const emailSchema = z.string().email('Invalid email address');
const phoneSchema = z.string().max(20, 'Phone too long').optional().or(z.literal(''));
const uuidSchema = z.string().uuid('Invalid ID');

// Helper: validate a form and return typed result
type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; errors: Record<string, string> };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}

// ============================================
// PATIENT
// ============================================

export const patientFormSchema = z.object({
  mrn: z.string().min(1, 'MRN is required').max(50),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  middleName: z.string().max(100).optional().or(z.literal('')),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  sex: z.enum(['male', 'female', 'other', 'unknown']),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(50).optional().or(z.literal('')),
  zipCode: z.string().max(20).optional().or(z.literal('')),
  insuranceProvider: z.string().max(200).optional().or(z.literal('')),
  insurancePolicyNumber: z.string().max(100).optional().or(z.literal('')),
  insuranceGroupNumber: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type PatientFormData = z.infer<typeof patientFormSchema>;

// ============================================
// PROVIDER
// ============================================

export const providerFormSchema = z.object({
  npi: z.string().min(1, 'NPI is required').max(20),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  credentials: z.string().max(50).optional().or(z.literal('')),
  organization: z.string().max(200).optional().or(z.literal('')),
  specialty: z.string().max(100).optional().or(z.literal('')),
  phone: phoneSchema,
  fax: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(50).optional().or(z.literal('')),
  zipCode: z.string().max(20).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type ProviderFormData = z.infer<typeof providerFormSchema>;

// ============================================
// STAFF
// ============================================

export const staffFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: emailSchema,
  role: z.enum(['lab_director', 'pathologist', 'supervisor', 'medical_technologist', 'technician', 'phlebotomist', 'admin']),
  licenseNumber: z.string().max(100).optional().or(z.literal('')),
  licenseType: z.string().max(100).optional().or(z.literal('')),
  licenseExpiry: z.string().optional().or(z.literal('')),
  department: z.enum(['chemistry', 'hematology', 'microbiology', 'immunology', 'pathology', 'phlebotomy', 'general']).optional().or(z.literal('')),
  phone: phoneSchema,
  status: z.enum(['active', 'on_leave', 'inactive']),
  hireDate: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type StaffFormData = z.infer<typeof staffFormSchema>;

// ============================================
// TEST CATALOG
// ============================================

export const testCatalogFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  loincCode: z.string().max(20).optional().or(z.literal('')),
  cptCode: z.string().max(20).optional().or(z.literal('')),
  category: z.enum(['chemistry', 'hematology', 'microbiology', 'immunology', 'molecular', 'pathology', 'urinalysis', 'panel']),
  specimenType: z.enum(['blood', 'serum', 'plasma', 'urine', 'stool', 'swab', 'csf', 'tissue', 'sputum', 'other']),
  turnaroundHours: z.number().min(0, 'Must be ≥ 0').max(10000),
  price: z.number().min(0, 'Must be ≥ 0'),
  unit: z.string().max(50).optional().or(z.literal('')),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  referenceRangeText: z.string().max(200).optional().or(z.literal('')),
  isPanel: z.boolean(),
  panelComponentIds: z.array(uuidSchema).optional(),
  active: z.boolean(),
});
export type TestCatalogFormData = z.infer<typeof testCatalogFormSchema>;

// ============================================
// ORDER
// ============================================

export const orderItemInputSchema = z.object({
  testCatalogId: uuidSchema,
  testName: z.string().min(1),
  price: z.number().min(0),
  status: z.enum(['pending', 'in_progress', 'resulted', 'cancelled']),
});

export const orderFormSchema = z.object({
  patientId: uuidSchema,
  providerId: uuidSchema,
  priority: z.enum(['routine', 'stat', 'asap']),
  status: z.enum(['ordered', 'collected', 'received', 'in_progress', 'resulted', 'completed', 'cancelled']),
  orderedDate: z.string().min(1, 'Order date is required'),
  clinicalNotes: z.string().max(2000).optional().or(z.literal('')),
  icd10Codes: z.string().max(500).optional().or(z.literal('')),
  items: z.array(orderItemInputSchema).min(1, 'At least one test is required'),
});
export type OrderFormData = z.infer<typeof orderFormSchema>;

// ============================================
// SPECIMEN
// ============================================

export const specimenFormSchema = z.object({
  accessionNumber: z.string().min(1, 'Accession number is required').max(50),
  orderId: uuidSchema,
  specimenType: z.enum(['blood', 'serum', 'plasma', 'urine', 'stool', 'swab', 'csf', 'tissue', 'sputum', 'other']),
  status: z.enum(['pending_collection', 'collected', 'in_transit', 'received', 'stored', 'rejected', 'disposed']),
  collectedBy: z.string().max(100).optional().or(z.literal('')),
  collectionDate: z.string().optional().or(z.literal('')),
  receivedDate: z.string().optional().or(z.literal('')),
  storageLocation: z.string().max(100).optional().or(z.literal('')),
  rejectionReason: z.enum(['hemolyzed', 'insufficient_volume', 'clotted', 'mislabeled', 'contaminated', 'expired', 'other']).optional().or(z.literal('')),
  rejectionNotes: z.string().max(500).optional().or(z.literal('')),
});
export type SpecimenFormData = z.infer<typeof specimenFormSchema>;

// ============================================
// TEST RESULT
// ============================================

export const testResultFormSchema = z.object({
  orderId: uuidSchema,
  orderItemId: uuidSchema,
  specimenId: uuidSchema,
  testCatalogId: uuidSchema,
  patientId: uuidSchema,
  resultValue: z.string().min(1, 'Result value is required').max(500),
  unit: z.string().max(50).optional().or(z.literal('')),
  referenceRange: z.string().max(100).optional().or(z.literal('')),
  flag: z.enum(['normal', 'low', 'high', 'critical_low', 'critical_high', 'abnormal']),
  status: z.enum(['preliminary', 'pending_verification', 'verified', 'amended']),
  performedBy: z.string().max(100).optional().or(z.literal('')),
  verifiedBy: z.string().max(100).optional().or(z.literal('')),
  resultDate: z.string().optional().or(z.literal('')),
  verifiedDate: z.string().optional().or(z.literal('')),
  instrumentId: z.string().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type TestResultFormData = z.infer<typeof testResultFormSchema>;

// ============================================
// INSTRUMENT
// ============================================

export const instrumentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  manufacturer: z.string().max(200).optional().or(z.literal('')),
  model: z.string().max(200).optional().or(z.literal('')),
  serialNumber: z.string().max(100).optional().or(z.literal('')),
  category: z.enum(['chemistry', 'hematology', 'microbiology', 'immunology', 'molecular', 'pathology', 'urinalysis', 'panel']),
  location: z.string().max(200).optional().or(z.literal('')),
  status: z.enum(['operational', 'maintenance', 'calibration', 'out_of_service', 'retired']),
  lastMaintenanceDate: z.string().optional().or(z.literal('')),
  nextMaintenanceDate: z.string().optional().or(z.literal('')),
  lastCalibrationDate: z.string().optional().or(z.literal('')),
  nextCalibrationDate: z.string().optional().or(z.literal('')),
  installDate: z.string().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type InstrumentFormData = z.infer<typeof instrumentFormSchema>;

// ============================================
// REAGENT
// ============================================

export const reagentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  catalogNumber: z.string().max(100).optional().or(z.literal('')),
  lotNumber: z.string().min(1, 'Lot number is required').max(100),
  manufacturer: z.string().max(200).optional().or(z.literal('')),
  category: z.enum(['reagent', 'control', 'calibrator', 'consumable', 'kit']),
  quantityOnHand: z.number().min(0),
  unit: z.string().min(1, 'Unit is required').max(50),
  reorderPoint: z.number().min(0),
  expirationDate: z.string().min(1, 'Expiration date is required'),
  storageLocation: z.string().max(200).optional().or(z.literal('')),
  instrumentId: z.string().optional().or(z.literal('')),
  status: z.enum(['in_stock', 'low_stock', 'expired', 'on_order']),
});
export type ReagentFormData = z.infer<typeof reagentFormSchema>;

// ============================================
// INVOICE
// ============================================

export const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(50),
  orderId: uuidSchema,
  patientId: uuidSchema,
  totalAmount: z.number().min(0),
  amountPaid: z.number().min(0),
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'void']),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  insuranceClaimId: z.string().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

// ============================================
// INSURANCE CLAIM
// ============================================

export const claimFormSchema = z.object({
  claimNumber: z.string().min(1, 'Claim number is required').max(50),
  invoiceId: uuidSchema,
  patientId: uuidSchema,
  insuranceProvider: z.string().min(1, 'Insurance provider is required').max(200),
  policyNumber: z.string().max(100).optional().or(z.literal('')),
  claimAmount: z.number().min(0),
  approvedAmount: z.number().min(0).optional(),
  status: z.enum(['draft', 'submitted', 'in_review', 'approved', 'partially_approved', 'denied', 'paid']),
  submittedDate: z.string().optional().or(z.literal('')),
  resolvedDate: z.string().optional().or(z.literal('')),
  denialReason: z.string().max(500).optional().or(z.literal('')),
});
export type ClaimFormData = z.infer<typeof claimFormSchema>;

// ============================================
// QC RUN
// ============================================

export const qcRunFormSchema = z.object({
  instrumentId: uuidSchema,
  testCatalogId: uuidSchema,
  controlLevel: z.enum(['level_1', 'level_2', 'level_3']),
  controlLotNumber: z.string().max(100).optional().or(z.literal('')),
  measuredValue: z.number(),
  expectedMean: z.number(),
  expectedSd: z.number().min(0.0001, 'SD must be > 0'),
  result: z.enum(['pass', 'warning', 'fail']),
  performedBy: z.string().max(100).optional().or(z.literal('')),
  runDate: z.string().min(1, 'Run date is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type QCRunFormData = z.infer<typeof qcRunFormSchema>;
