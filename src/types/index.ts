// User and Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
  createdAt: string;
}

// Work Order Types
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  type: 'maintenance' | 'burial_prep' | 'grounds' | 'repair' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  dueDate?: string;
  completedDate?: string;
  /** Staff member who created the record; null when created without a session. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  name: string;
  category: 'casket' | 'urn' | 'vault' | 'marker' | 'supplies' | 'other';
  sku?: string;
  quantity: number;
  reorderPoint: number;
  unitPrice: number;
  vendorId?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

// Financial Types
export interface Deposit {
  id: string;
  amount: number;
  date: string;
  method: 'cash' | 'check' | 'credit_card' | 'wire' | 'other';
  reference?: string;
  customerId?: string;
  notes?: string;
  /** Staff member who created the record; null when created without a session. */
  createdBy: string | null;
  createdAt: string;
}

export interface AccountsReceivable {
  id: string;
  customerId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

export interface AccountsPayable {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

// Burial Types
export interface Burial {
  id: string;
  deceasedFirstName: string;
  deceasedLastName: string;
  deceasedMiddleName?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  burialDate: string;
  plotLocation: string;
  section: string;
  lot: string;
  grave: string;
  graveId?: string;
  memorialPublished?: boolean;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  permitNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Contract Types
export interface Contract {
  id: string;
  contractNumber: string;
  type: 'pre_need' | 'at_need';
  customerId: string;
  totalAmount: number;
  amountPaid: number;
  status: 'active' | 'paid' | 'cancelled' | 'transferred';
  signedDate: string;
  items: ContractItem[];
  paymentPlan?: PaymentPlan;
  createdAt: string;
  updatedAt: string;
}

export interface ContractItem {
  id: string;
  description: string;
  amount: number;
  inventoryId?: string;
  quantity?: number;
}

/**
 * Stored as JSONB in `contracts.payment_plan`.
 *
 * Declared as a type alias rather than an interface on purpose: this has to be
 * assignable to the generated `Json` type, and TypeScript only gives implicit
 * index signatures to type aliases. An interface here fails that check even
 * though the shape is identical.
 */
export type PaymentPlan = {
  frequency: 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly';
  installmentAmount: number;
  startDate: string;
  endDate?: string;
};

// Grant Types
export interface Grant {
  id: string;
  title: string;
  description: string;
  type: 'grant' | 'benefit' | 'opportunity';
  source: string;
  amount?: number;
  deadline?: string;
  status: 'available' | 'applied' | 'approved' | 'denied' | 'received';
  applicationDate?: string;
  notes?: string;
  /** Staff member who created the record; null when created without a session. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Customer/Contact Types
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Payment Schedule
export interface PaymentScheduleEntry {
  id: string;
  contractId: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Cemetery Hierarchy
export interface Cemetery {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  cemeteryId: string;
  name: string;
  description?: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Lot {
  id: string;
  sectionId: string;
  lotNumber: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Grave {
  id: string;
  lotId: string;
  graveNumber: string;
  status: 'available' | 'reserved' | 'occupied' | 'unavailable';
  lat?: number;
  lng?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
