// User and Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff";
  createdAt: Date;
}

// Work Order Types
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  type: "maintenance" | "burial_prep" | "grounds" | "repair" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  assignedTo?: string;
  dueDate?: Date;
  completedDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  name: string;
  category: "casket" | "urn" | "vault" | "marker" | "supplies" | "other";
  sku?: string;
  quantity: number;
  reorderPoint: number;
  unitPrice: number;
  vendorId?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Financial Types
export interface Deposit {
  id: string;
  amount: number;
  date: Date;
  method: "cash" | "check" | "credit_card" | "wire" | "other";
  reference?: string;
  customerId?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export interface AccountsReceivable {
  id: string;
  customerId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: Date;
  status: "pending" | "partial" | "paid" | "overdue";
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountsPayable {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: Date;
  status: "pending" | "partial" | "paid" | "overdue";
  createdAt: Date;
  updatedAt: Date;
}

// Burial Types
export interface Burial {
  id: string;
  deceasedFirstName: string;
  deceasedLastName: string;
  deceasedMiddleName?: string;
  dateOfBirth?: Date;
  dateOfDeath?: Date;
  burialDate: Date;
  plotLocation: string;
  section: string;
  lot: string;
  grave: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  permitNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Contract Types
export interface Contract {
  id: string;
  contractNumber: string;
  type: "pre_need" | "at_need";
  customerId: string;
  totalAmount: number;
  amountPaid: number;
  status: "active" | "paid" | "cancelled" | "transferred";
  signedDate: Date;
  items: ContractItem[];
  paymentPlan?: PaymentPlan;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractItem {
  id: string;
  description: string;
  amount: number;
}

export interface PaymentPlan {
  frequency: "weekly" | "bi_weekly" | "monthly" | "quarterly";
  installmentAmount: number;
  startDate: Date;
  endDate?: Date;
}

// Grant Types
export interface Grant {
  id: string;
  title: string;
  description: string;
  type: "grant" | "benefit" | "opportunity";
  source: string;
  amount?: number;
  deadline?: Date;
  status: "available" | "applied" | "approved" | "denied" | "received";
  applicationDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
