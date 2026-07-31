/**
 * Tests for navigation gating.
 *
 * `permissions.test.ts` proves `can()` returns the right answer. These tests
 * prove the nav actually *uses* that answer — a distinction that matters,
 * because a correct permission table wired to nothing protects nothing.
 *
 * The command palette is the reason this is worth testing separately. It builds
 * its page list from `navItemsFor(role)` rather than from `NAV_ITEMS`, so a
 * regression there would turn ⌘K into a way to reach an admin-only route that
 * the sidebar hides. `AdminRoute` and RLS would still refuse, but offering a
 * door that opens onto a wall is a bug in its own right.
 */
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, navItemsFor } from './nav';
import type { AppRole } from '../lib/permissions';

const ADMIN_ONLY_PATHS = NAV_ITEMS.filter((i) => i.adminOnly).map((i) => i.path);
const NON_ADMIN_ROLES: AppRole[] = ['staff', 'readonly'];

describe('navItemsFor', () => {
  it('has at least one admin-only entry, or these tests prove nothing', () => {
    expect(ADMIN_ONLY_PATHS.length).toBeGreaterThan(0);
    expect(ADMIN_ONLY_PATHS).toContain('/users');
  });

  it('gives admins every entry', () => {
    expect(navItemsFor('admin')).toHaveLength(NAV_ITEMS.length);
  });

  it.each(NON_ADMIN_ROLES)('hides every admin-only entry from %s', (role) => {
    const paths = navItemsFor(role).map((i) => i.path);
    for (const adminPath of ADMIN_ONLY_PATHS) {
      expect(paths).not.toContain(adminPath);
    }
  });

  it.each(NON_ADMIN_ROLES)('still gives %s the ordinary entries', (role) => {
    const paths = navItemsFor(role).map((i) => i.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/burials');
    expect(paths).toHaveLength(NAV_ITEMS.length - ADMIN_ONLY_PATHS.length);
  });

  // A null role is the window between "signed in" and "profile loaded". Failing
  // closed there keeps an admin-only link from flashing in and back out, and
  // means a profile that never loads cannot widen the nav.
  it.each([[null], [undefined]])('fails closed while the role is %s', (role) => {
    const paths = navItemsFor(role as AppRole | null | undefined).map((i) => i.path);
    for (const adminPath of ADMIN_ONLY_PATHS) {
      expect(paths).not.toContain(adminPath);
    }
  });

  it('rejects an unrecognised role rather than defaulting it open', () => {
    // A build older than the database could meet a role it has never heard of.
    const paths = navItemsFor('superuser' as AppRole).map((i) => i.path);
    expect(paths).not.toContain('/users');
  });

  it('never returns an entry that is absent from NAV_ITEMS', () => {
    const known = new Set(NAV_ITEMS.map((i) => i.path));
    for (const role of ['admin', ...NON_ADMIN_ROLES] as AppRole[]) {
      for (const item of navItemsFor(role)) expect(known.has(item.path)).toBe(true);
    }
  });

  it('returns entries in the declared order', () => {
    const adminPaths = navItemsFor('admin').map((i) => i.path);
    expect(adminPaths).toEqual(NAV_ITEMS.map((i) => i.path));
  });
});
