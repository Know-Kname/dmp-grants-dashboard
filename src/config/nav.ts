/**
 * Single source of truth for the app's navigation entries, shared by the
 * Layout (sidebar, mobile bar, More sheet) and the command palette.
 */
import {
  Home, FileText, Package, DollarSign, Users,
  FileSignature, Gift, ClipboardList, Building2, Map, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { can, type AppRole } from '../lib/permissions';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  description: string;
  /**
   * Hide this entry from anyone who cannot manage users.
   *
   * Nav visibility is presentation, not protection — `/users` is also guarded by
   * `AdminRoute` in `App.tsx`, and the data behind it by RLS on `profiles`. This
   * only keeps the sidebar and the command palette honest about what a given
   * user can actually open.
   */
  adminOnly?: boolean;
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
  { icon: ShieldCheck, label: 'Users', path: '/users', description: 'Roles & access', adminOnly: true },
];

/**
 * The nav entries a given role may see.
 *
 * @param role The signed-in user's role, or `null` while it is still loading —
 *             which yields the non-admin list, so an admin-only entry never
 *             flashes in and out during sign-in.
 */
export function navItemsFor(role: AppRole | null | undefined): NavItem[] {
  const isAdmin = can(role, 'manageUsers');
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}
