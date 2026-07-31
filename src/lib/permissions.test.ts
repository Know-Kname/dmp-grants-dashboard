/**
 * Every role × every action, spelled out.
 *
 * The table below is copied from the *measured* behaviour of the deployed RLS
 * policies, not from `permissions.ts` — that is the whole point. If someone
 * relaxes a rule in the capability table without changing the database, this
 * fails.
 *
 *   admin       select=yes insert=yes  update=yes delete=yes
 *   staff       select=yes insert=yes  update=yes delete=no
 *   readonly    select=yes insert=no   update=no  delete=no
 *
 * plus `profiles`: only admins may list accounts or change roles.
 */
import { describe, expect, it } from 'vitest';
import {
  APP_ROLES,
  DEFAULT_ROLE,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  can,
  capabilitiesOf,
  isAppRole,
  toAppRole,
  type AppRole,
  type PermissionAction,
} from './permissions';

const EXPECTED: Record<AppRole, Record<PermissionAction, boolean>> = {
  admin: { read: true, create: true, update: true, delete: true, manageUsers: true },
  staff: { read: true, create: true, update: true, delete: false, manageUsers: false },
  readonly: { read: true, create: false, update: false, delete: false, manageUsers: false },
};

const ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete', 'manageUsers'];

describe('can(role, action)', () => {
  for (const role of APP_ROLES) {
    for (const action of ACTIONS) {
      const expected = EXPECTED[role][action];
      it(`${role} ${expected ? 'may' : 'may not'} ${action}`, () => {
        expect(can(role, action)).toBe(expected);
      });
    }
  }

  it('covers every role the type allows', () => {
    expect([...APP_ROLES].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('grants nothing at all while the role is unknown', () => {
    for (const action of ACTIONS) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('grants nothing for a role string this build has never heard of', () => {
    // A fourth role added to the database CHECK constraint before the client
    // knows about it must not be read as "probably fine".
    for (const action of ACTIONS) {
      expect(can('superuser' as AppRole, action)).toBe(false);
    }
  });

  it('only admins may delete', () => {
    expect(APP_ROLES.filter((r) => can(r, 'delete'))).toEqual(['admin']);
  });

  it('only admins may manage users', () => {
    expect(APP_ROLES.filter((r) => can(r, 'manageUsers'))).toEqual(['admin']);
  });

  it('every role may read — deactivation, not role, is what removes read access', () => {
    expect(APP_ROLES.every((r) => can(r, 'read'))).toBe(true);
  });
});

describe('capabilitiesOf', () => {
  it('matches can() for every role', () => {
    for (const role of APP_ROLES) {
      expect(capabilitiesOf(role)).toEqual(EXPECTED[role]);
    }
  });

  it('is all-false for an unknown role', () => {
    expect(capabilitiesOf(null)).toEqual({
      read: false,
      create: false,
      update: false,
      delete: false,
      manageUsers: false,
    });
  });

  it('returns a copy, so a caller cannot mutate the shared table', () => {
    const caps = capabilitiesOf('readonly');
    caps.delete = true;
    expect(can('readonly', 'delete')).toBe(false);
  });
});

describe('isAppRole / toAppRole', () => {
  it('accepts exactly the three database roles', () => {
    for (const role of APP_ROLES) expect(isAppRole(role)).toBe(true);
  });

  it.each([null, undefined, '', 'Admin', 'ADMIN', 'owner', 42, {}, ['admin']])(
    'rejects %o',
    (value) => {
      expect(isAppRole(value)).toBe(false);
    }
  );

  it('falls back to the least-privileged role', () => {
    expect(DEFAULT_ROLE).toBe('readonly');
    expect(toAppRole('nonsense')).toBe('readonly');
    expect(toAppRole(null)).toBe('readonly');
    expect(toAppRole('admin')).toBe('admin');
  });
});

describe('role metadata', () => {
  it('labels and describes every role', () => {
    for (const role of APP_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });
});
