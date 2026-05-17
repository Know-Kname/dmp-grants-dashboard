// ============================================
// SHARED ENUMS
// ============================================

export type Sex = 'male' | 'female' | 'other' | 'unknown';

export type StaffRole =
  | 'lab_director'
  | 'pathologist'
  | 'supervisor'
  | 'medical_technologist'
  | 'technician'
  | 'phlebotomist'
  | 'admin';

export type Department =
  | 'chemistry'
  | 'hematology'
  | 'microbiology'
  | 'immunology'
  | 'pathology'
  | 'phlebotomy'
  | 'general';

export type StaffStatus = 'active' | 'on_leave' | 'inactive';

export type ProviderStatus = 'active' | 'inactive';

export type TestCategory =
  | 'chemistry'
  | 'hematology'
  | 'microbiology'
  | 'immunology'
  | 'molecular'
  | 'pathology'
  | 'urinalysis'
  | 'panel';

export type SpecimenType =
  | 'blood'
  | 'serum'
  | 'plasma'
  | 'urine'
  | 'stool'
  | 'swab'
  | 'csf'
  | 'tissue'
  | 'sputum'
  | 'other';

export type OrderPriority = 'routine' | 'stat' | 'asap';

export type OrderStatus =
  | 'ordered'
  | 'collected'
  | 'received'
  | 'in_progress'
  | 'resulted'
  | 'completed'
  | 'cancelled';

export type OrderItemStatus = 'pending' | 'in_progress' | 'resulted' | 'cancelled';

export type SpecimenStatus =
  | 'pending_collection'
  | 'collected'
  | 'in_transit'
  | 'received'
  | 'stored'
  | 'rejected'
  | 'disposed';

export type RejectionReason =
  | 'hemolyzed'
  | 'insufficient_volume'
  | 'clotted'
  | 'mislabeled'
  | 'contaminated'
  | 'expired'
  | 'other';

export type ResultFlag =
  | 'normal'
  | 'low'
  | 'high'
  | 'critical_low'
  | 'critical_high'
  | 'abnormal';

export type ResultStatus =
  | 'preliminary'
  | 'pending_verification'
  | 'verified'
  | 'amended';

export type InstrumentStatus =
  | 'operational'
  | 'maintenance'
  | 'calibration'
  | 'out_of_service'
  | 'retired';

export type ReagentCategory = 'reagent' | 'control' | 'calibrator' | 'consumable' | 'kit';

export type ReagentStatus = 'in_stock' | 'low_stock' | 'expired' | 'on_order';

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'partially_approved'
  | 'denied'
  | 'paid';

export type QCControlLevel = 'level_1' | 'level_2' | 'level_3';

export type QCResult = 'pass' | 'warning' | 'fail';

export type UserRole = 'admin' | 'lab_director' | 'technologist' | 'staff';

// ============================================
// CORE ENTITIES
// ============================================

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  sex: Sex;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceGroupNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Provider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  credentials?: string;
  organization?: string;
  specialty?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  status: ProviderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: StaffRole;
  licenseNumber?: string;
  licenseType?: string;
  licenseExpiry?: string;
  department?: Department;
  phone?: string;
  status: StaffStatus;
  hireDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCatalogItem {
  id: string;
  code: string;
  name: string;
  loincCode?: string;
  cptCode?: string;
  category: TestCategory;
  specimenType: SpecimenType;
  turnaroundHours: number;
  price: number;
  unit?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  referenceRangeText?: string;
  isPanel: boolean;
  panelComponentIds?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ORDERS
// ============================================

export interface OrderItem {
  id: string;
  orderId: string;
  testCatalogId: string;
  testName: string;
  price: number;
  status: OrderItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TestOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  providerId: string;
  priority: OrderPriority;
  status: OrderStatus;
  orderedDate: string;
  clinicalNotes?: string;
  icd10Codes?: string[];
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SPECIMENS & RESULTS
// ============================================

export interface Specimen {
  id: string;
  accessionNumber: string;
  orderId: string;
  patientId: string;
  specimenType: SpecimenType;
  status: SpecimenStatus;
  collectedBy?: string;
  collectionDate?: string;
  receivedDate?: string;
  storageLocation?: string;
  rejectionReason?: RejectionReason;
  rejectionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestResult {
  id: string;
  orderId: string;
  orderItemId: string;
  specimenId: string;
  testCatalogId: string;
  patientId: string;
  resultValue: string;
  unit?: string;
  referenceRange?: string;
  flag: ResultFlag;
  status: ResultStatus;
  performedBy?: string;
  verifiedBy?: string;
  resultDate?: string;
  verifiedDate?: string;
  instrumentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INSTRUMENTS & REAGENTS
// ============================================

export interface Instrument {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  category: TestCategory;
  location?: string;
  status: InstrumentStatus;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  installDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reagent {
  id: string;
  name: string;
  catalogNumber?: string;
  lotNumber: string;
  manufacturer?: string;
  category: ReagentCategory;
  quantityOnHand: number;
  unit: string;
  reorderPoint: number;
  expirationDate: string;
  storageLocation?: string;
  instrumentId?: string;
  status: ReagentStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BILLING
// ============================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  patientId: string;
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  insuranceClaimId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  invoiceId: string;
  patientId: string;
  insuranceProvider: string;
  policyNumber?: string;
  claimAmount: number;
  approvedAmount?: number;
  status: ClaimStatus;
  submittedDate?: string;
  resolvedDate?: string;
  denialReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// QUALITY CONTROL
// ============================================

export interface QCRun {
  id: string;
  instrumentId: string;
  testCatalogId: string;
  controlLevel: QCControlLevel;
  controlLotNumber?: string;
  measuredValue: number;
  expectedMean: number;
  expectedSd: number;
  result: QCResult;
  performedBy?: string;
  runDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// AUTH
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
