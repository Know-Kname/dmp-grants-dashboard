/**
 * Demo/Preview Mode Data
 * Mock data for showcasing the application without a database connection
 */

import type { User, WorkOrder, Grant, Burial, Customer, InventoryItem } from '../types';

// Demo user for preview mode
export const DEMO_USER: User = {
  id: 'demo-user-001',
  email: 'demo@detroitmemorialpark.org',
  name: 'Demo User',
  role: 'admin',
  createdAt: '2024-01-01T00:00:00.000Z',
};

// Demo work orders
export const DEMO_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-001',
    title: 'Lawn maintenance - Section A',
    description: 'Regular mowing and trimming for Section A memorial gardens',
    type: 'grounds',
    priority: 'medium',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'demo-user-001',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wo-002',
    title: 'Headstone repair - Plot 142',
    description: 'Minor crack repair on granite headstone',
    type: 'repair',
    priority: 'high',
    status: 'pending',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'demo-user-001',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wo-003',
    title: 'Burial preparation - Section C-47',
    description: 'Prepare gravesite for upcoming burial service',
    type: 'burial_prep',
    priority: 'urgent',
    status: 'pending',
    dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    createdBy: 'demo-user-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wo-004',
    title: 'Irrigation system check',
    description: 'Quarterly inspection of sprinkler systems',
    type: 'maintenance',
    priority: 'low',
    status: 'completed',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'demo-user-001',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'wo-005',
    title: 'Tree trimming - West entrance',
    description: 'Trim overhanging branches near main road',
    type: 'grounds',
    priority: 'medium',
    status: 'completed',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'demo-user-001',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo grants
export const DEMO_GRANTS: Grant[] = [
  {
    id: 'grant-001',
    title: 'Historic Preservation Grant',
    description: 'Federal funding for restoration of historic monuments and mausoleums',
    type: 'grant',
    source: 'National Trust for Historic Preservation',
    amount: 50000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'available',
    createdBy: 'demo',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'grant-002',
    title: 'Veterans Memorial Fund',
    description: 'Support for maintenance of veteran burial sections',
    type: 'benefit',
    source: 'Michigan Department of Veterans Affairs',
    amount: 25000,
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'applied',
    createdBy: 'demo',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'grant-003',
    title: 'Green Cemetery Initiative',
    description: 'Funding for eco-friendly burial options and sustainable landscaping',
    type: 'opportunity',
    source: 'Environmental Protection Agency',
    amount: 75000,
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'available',
    createdBy: 'demo',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'grant-004',
    title: 'Community Development Block Grant',
    description: 'Infrastructure improvements for cemetery access roads',
    type: 'grant',
    source: 'City of Warren',
    amount: 35000,
    deadline: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    createdBy: 'demo',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo burials (sample historical records)
export const DEMO_BURIALS: Burial[] = [
  {
    id: 'burial-001',
    deceasedFirstName: 'Robert',
    deceasedLastName: 'Johnson',
    deceasedMiddleName: 'Earl',
    dateOfBirth: '1945-03-15',
    dateOfDeath: '2024-01-10',
    burialDate: '2024-01-17',
    plotLocation: 'East-A-142-3',
    section: 'A',
    lot: '142',
    grave: '3',
    contactName: 'Mary Johnson',
    contactPhone: '(586) 555-0123',
    permitNumber: 'BP-2024-0042',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'burial-002',
    deceasedFirstName: 'Eleanor',
    deceasedLastName: 'Williams',
    dateOfBirth: '1932-07-22',
    dateOfDeath: '2024-02-01',
    burialDate: '2024-02-08',
    plotLocation: 'East-B-87-1',
    section: 'B',
    lot: '87',
    grave: '1',
    contactName: 'James Williams',
    contactPhone: '(313) 555-0456',
    permitNumber: 'BP-2024-0089',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'burial-003',
    deceasedFirstName: 'Marcus',
    deceasedLastName: 'Thompson',
    deceasedMiddleName: 'David',
    dateOfBirth: '1958-11-30',
    dateOfDeath: '2024-01-25',
    burialDate: '2024-02-02',
    plotLocation: 'West-C-215-4',
    section: 'C',
    lot: '215',
    grave: '4',
    contactName: 'Patricia Thompson',
    contactPhone: '(810) 555-0789',
    permitNumber: 'BP-2024-0076',
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Demo customers
export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cust-001',
    firstName: 'Mary',
    lastName: 'Johnson',
    email: 'mary.johnson@email.com',
    phone: '(586) 555-0123',
    address: '1234 Oak Street',
    city: 'Warren',
    state: 'MI',
    zipCode: '48092',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust-002',
    firstName: 'James',
    lastName: 'Williams',
    email: 'jwilliams@email.com',
    phone: '(313) 555-0456',
    address: '5678 Maple Ave',
    city: 'Detroit',
    state: 'MI',
    zipCode: '48201',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust-003',
    firstName: 'Patricia',
    lastName: 'Thompson',
    email: 'pthompson@email.com',
    phone: '(810) 555-0789',
    address: '910 Pine Road',
    city: 'Flint',
    state: 'MI',
    zipCode: '48505',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Demo inventory
export const DEMO_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-001',
    name: 'Standard Bronze Casket',
    category: 'casket',
    sku: 'CSK-BRZ-001',
    quantity: 12,
    reorderPoint: 5,
    unitPrice: 2500,
    location: 'Warehouse A',
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-002',
    name: 'Marble Cremation Urn',
    category: 'urn',
    sku: 'URN-MRB-002',
    quantity: 25,
    reorderPoint: 10,
    unitPrice: 350,
    location: 'Warehouse A',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-003',
    name: 'Concrete Burial Vault',
    category: 'vault',
    sku: 'VLT-CON-001',
    quantity: 8,
    reorderPoint: 3,
    unitPrice: 1200,
    location: 'Outdoor Storage',
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-004',
    name: 'Granite Headstone - Standard',
    category: 'marker',
    sku: 'MRK-GRN-001',
    quantity: 15,
    reorderPoint: 5,
    unitPrice: 1800,
    location: 'Warehouse B',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-005',
    name: 'Flower Arrangement - Premium',
    category: 'supplies',
    sku: 'SUP-FLR-001',
    quantity: 3,
    reorderPoint: 10,
    unitPrice: 75,
    location: 'Chapel Storage',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Demo statistics for dashboard
export const DEMO_STATS = {
  totalBurials: 39373,
  burialsThisMonth: 47,
  burialsThisYear: 312,
  activeWorkOrders: 23,
  completedWorkOrders: 156,
  pendingWorkOrders: 18,
  totalCustomers: 8542,
  activeContracts: 234,
  totalInventoryValue: 285000,
  lowStockItems: 3,
  pendingGrants: 4,
  approvedGrantsValue: 110000,
  monthlyRevenue: 125000,
  outstandingReceivables: 45000,
  pendingPayables: 28000,
};

// Check if demo mode is active
export function isDemoMode(): boolean {
  return localStorage.getItem('dmp-demo-mode') === 'true';
}

// Enable demo mode
export function enableDemoMode(): void {
  localStorage.setItem('dmp-demo-mode', 'true');
  window.dispatchEvent(new CustomEvent('dmp-demo-change', { detail: true }));
  localStorage.setItem('dmp-token', 'demo-token');
  localStorage.setItem('dmp-user', JSON.stringify(DEMO_USER));
}

// Disable demo mode
export function disableDemoMode(): void {
  localStorage.removeItem('dmp-demo-mode');
  localStorage.removeItem('dmp-token');
  localStorage.removeItem('dmp-user');
  window.dispatchEvent(new CustomEvent('dmp-demo-change', { detail: false }));
}
