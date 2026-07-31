/**
 * Role capability table for the DMP CMS.
 *
 * ⚠️ THIS FILE IS NOT A SECURITY BOUNDARY. ⚠️
 *
 * Authorization is enforced in Postgres, by row-level security policies keyed on
 * `public.profiles.role` via the `current_app_role()` / `can_write()` /
 * `is_admin()` SQL helpers. Everything here is a *mirror* of those policies,
 * kept in the client so the UI can explain what a user may do — hide a Delete
 * button they can never use, disable a form they cannot submit — instead of
 * offering an action that fails.
 *
 * Anyone can edit this file's answers in a debugger, or skip it entirely and
 * call Supabase directly from a console. That is fine: the database refuses
 * regardless. What is NOT fine is the reverse — adding a capability here that
 * the RLS policies do not grant. Then the UI invites an action that silently
 * fails (see `affectedRows` in `../hooks/useData`, which exists because a
 * refused UPDATE/DELETE returns 0 rows rather than an error).
 *
 * When the SQL policies change, change this table in the same commit.
 *
 * The server rules being mirrored, per business table:
 *   SELECT          — any active profile
 *   INSERT / UPDATE — 'admin' or 'staff'
 *   DELETE          — 'admin' only
 * and on `profiles` itself: own row readable by its owner, all rows readable and
 * updatable by admins; INSERT/DELETE are closed to the API entirely (the row is
 * created by a trigger on `auth.users`).
 *
 * A deactivated profile (`is_active = false`) can read nothing at all, so it is
 * not modelled as a role here — `../lib/auth` gates the whole app on it.
 */

/** The three values `profiles.role` is allowed to hold (CHECK constraint). */
export type AppRole = 'admin' | 'staff' | 'readonly';

/** Every role, in descending order of privilege. Useful for role pickers. */
export const APP_ROLES = ['admin', 'staff', 'readonly'] as const satisfies readonly AppRole[];

/**
 * The role the database assigns a brand-new profile.
 *
 * The `auth.users` trigger defaults `role` to `'readonly'`, so a freshly invited
 * user can see the app but change nothing until an admin promotes them. Anything
 * the client cannot identify is treated the same way — see {@link toAppRole}.
 */
export const DEFAULT_ROLE: AppRole = 'readonly';

/** Human labels for the roles, for `<Select>` options and badges. */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrator',
  staff: 'Staff',
  readonly: 'Read only',
};

/** One-line description of what each role may do, for the admin UI. */
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: 'Full access, including deleting records and managing user accounts.',
  staff: 'Can view, add and edit records, but cannot delete them.',
  readonly: 'Can view records only.',
};

/**
 * Things the UI asks about.
 *
 * `read`/`create`/`update`/`delete` are about the 16 business tables (burials,
 * contracts, inventory…) — the permissions are uniform across them, exactly as
 * the RLS policies are. `manageUsers` is about `/users`: listing every profile
 * and changing roles.
 */
export type PermissionAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'manageUsers';

/**
 * The mirror of the RLS policies. Read a row as "what this role may do".
 *
 * Kept as an exhaustive literal rather than derived from a rank order: the
 * server rules are not a strict ladder in spirit (staff may edit but not
 * delete), and spelling every cell out means a policy change has an obvious,
 * reviewable diff here.
 */
const CAPABILITIES: Record<AppRole, Record<PermissionAction, boolean>> = {
  admin: {
    read: true,
    create: true,
    update: true,
    delete: true,
    manageUsers: true,
  },
  staff: {
    read: true,
    create: true,
    update: true,
    delete: false,
    manageUsers: false,
  },
  readonly: {
    read: true,
    create: false,
    update: false,
    delete: false,
    manageUsers: false,
  },
};

/**
 * Narrow an unknown value — a `role` column read at runtime, a URL parameter —
 * to an {@link AppRole}.
 */
export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Coerce anything to a role, falling back to the least-privileged one.
 *
 * Used at the `profiles` boundary. If the database ever grows a fourth role
 * that this build has not heard of, the safe reading of it is "no more power
 * than a fresh account", not "assume staff".
 */
export function toAppRole(value: unknown): AppRole {
  return isAppRole(value) ? value : DEFAULT_ROLE;
}

/**
 * May `role` perform `action`?
 *
 * @param role   The signed-in user's role, or `null`/`undefined` while the
 *               profile is still loading or missing. Both answer `false` —
 *               an unknown role gets no capability, so the UI shows nothing it
 *               might have to take away a moment later.
 * @param action What the UI wants to offer.
 * @returns `true` only when the server would also allow it.
 */
export function can(
  role: AppRole | null | undefined,
  action: PermissionAction
): boolean {
  if (!isAppRole(role)) return false;
  return CAPABILITIES[role][action];
}

/**
 * Every action `role` may perform. Handy for a component that needs several
 * answers at once without calling {@link can} four times.
 */
export function capabilitiesOf(
  role: AppRole | null | undefined
): Record<PermissionAction, boolean> {
  if (!isAppRole(role)) {
    return { read: false, create: false, update: false, delete: false, manageUsers: false };
  }
  return { ...CAPABILITIES[role] };
}
