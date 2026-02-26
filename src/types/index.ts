/**
 * DMP Domain Types
 *
 * CANONICAL RULE: All date/timestamp fields use ISO 8601 strings (not Date objects).
 * This keeps the type model consistent with:
 *   - Supabase row definitions (src/lib/supabase.ts) which return strings
 *   - Demo data (src/lib/demo-data.ts) which uses .toISOString()
 *   - JSON serialisation over the wire
 *
 * To work with actual Date objects in components, use:
 *   import { parseISO, format } from 'date-fns';
 *   const d = parseISO(burial.burialDate);
 */

// ── User & Auth ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
  createdAt: string; // ISO 8601
}

// ── Work Orders ───────────────────────────────────────────────────────────────
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  type: 'maintenance' | 'burial_prep' | 'grounds' | 'repair' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  dueDate?: string;        // ISO 8601
  completedDate?: string;  // ISO 8601
  createdBy: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}

// ── Inventory ─────────────────────────────────────────────────────────────────
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
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// ── Financial ─────────────────────────────────────────────────────────────────
export interface Deposit {
  id: string;
  amount: number;
  date: string;      // ISO 8601
  method: 'cash' | 'check' | 'credit_card' | 'wire' | 'other';
  reference?: string;
  customerId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string; // ISO 8601
}

export interface AccountsReceivable {
  id: string;
  customerId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: string;   // ISO 8601
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface AccountsPayable {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: string;   // ISO 8601
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ── Burial ────────────────────────────────────────────────────────────────────
export interface Burial {
  id: string;
  deceasedFirstName: string;
  deceasedLastName: string;
  deceasedMiddleName?: string;
  dateOfBirth?: string;  // ISO 8601
  dateOfDeath?: string;  // ISO 8601
  burialDate: string;    // ISO 8601  (required)
  plotLocation: string;
  section: string;
  lot: string;
  grave: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  permitNumber?: string;
  notes?: string;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

// ── Contracts ─────────────────────────────────────────────────────────────────
export interface Contract {
  id: string;
  contractNumber: string;
  type: 'pre_need' | 'at_need';
  customerId: string;
  totalAmount: number;
  amountPaid: number;
  status: 'active' | 'paid' | 'cancelled' | 'transferred';
  signedDate: string;  // ISO 8601
  items: ContractItem[];
  paymentPlan?: PaymentPlan;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

export interface ContractItem {
  id: string;
  description: string;
  amount: number;
}

export interface PaymentPlan {
  frequency: 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly';
  installmentAmount: number;
  startDate: string;   // ISO 8601
  endDate?: string;    // ISO 8601
}

// ── Grants ────────────────────────────────────────────────────────────────────
export interface Grant {
  id: string;
  title: string;
  description: string;
  type: 'grant' | 'benefit' | 'opportunity';
  source: string;
  amount?: number;
  deadline?: string;          // ISO 8601
  status: 'available' | 'applied' | 'approved' | 'denied' | 'received';
  applicationDate?: string;   // ISO 8601
  notes?: string;
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}

// ── Customer / Vendor ─────────────────────────────────────────────────────────
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
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
