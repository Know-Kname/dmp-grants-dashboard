/**
 * Single source of truth for the app's navigation entries, shared by the
 * Layout (sidebar, mobile bar, More sheet) and the command palette.
 */
import {
  Home, FileText, Package, DollarSign, Users,
  FileSignature, Gift, ClipboardList, Building2, Map,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/', description: 'Overview & metrics' },
  { icon: ClipboardList, label: 'Work Orders', path: '/work-orders', description: 'Tasks & maintenance' },
  { icon: Package, label: 'Inventory', path: '/inventory', description: 'Stock management' },
  { icon: DollarSign, label: 'Financial', path: '/financial', description: 'Payments & reports' },
  { icon: Users, label: 'Burials', path: '/burials', description: 'Records & locations' },
  { icon: FileSignature, label: 'Contracts', path: '/contracts', description: 'Agreements & docs' },
  { icon: Gift, label: 'Grants', path: '/grants', description: 'Funding & benefits' },
  { icon: FileText, label: 'Customers', path: '/customers', description: 'Contact information' },
  { icon: Building2, label: 'Vendors', path: '/vendors', description: 'Supplier management' },
  { icon: Map, label: 'Cemeteries', path: '/cemeteries', description: 'Plot & grave inventory' },
];
