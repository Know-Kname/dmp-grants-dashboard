/**
 * Staff accounts and roles. Admin only — RLS enforces it server-side.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query';
import { affectedRow } from '../../lib/writeResult';
import { profilesTable, type Profile, type ProfileRow } from '../../lib/profiles';
import { toAppRole, type AppRole } from '../../lib/permissions';
import type { TablesUpdate } from '../../types/database';
import { type MutationCallbacks, mutationSideEffects, sb } from './_shared';

// ============================================
// USER ACCOUNTS (PROFILES) — ADMIN ONLY
// ============================================

/**
 * `profiles` goes through `profilesTable()` rather than `supabase.from()`
 * because the generated `Database` type does not know the table yet — see the
 * header of `lib/profiles` for how that gets removed.
 */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: toAppRole(row.role),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROFILE_COLUMNS = 'id, email, full_name, role, is_active, created_at, updated_at';

/**
 * Every user account.
 *
 * Returns only the caller's own row for a non-admin — RLS decides, not this
 * hook. `/users` is admin-gated anyway; the narrow result is the backstop.
 */
export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: async () => {
      const rows = await sb(
        profilesTable().select(PROFILE_COLUMNS).order('created_at', { ascending: false })
      );
      return (rows as ProfileRow[]).map(toProfile);
    },
  });
}

/**
 * Change a user's role and/or active flag.
 *
 * Only admins may UPDATE `profiles`; for everyone else the policy filters the
 * row out and the write lands on nothing, so the result goes through
 * `affectedRow` like every other update in this file.
 *
 * There is deliberately no create or delete hook: INSERT and DELETE on
 * `profiles` are closed to the API entirely. Rows appear via the `auth.users`
 * trigger when an admin invites someone from the Supabase dashboard (see
 * docs/06-supabase.md) and disappear when the auth user is deleted.
 */
export function useUpdateProfile(callbacks?: MutationCallbacks<Profile>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, isActive }: { id: string; role?: AppRole; isActive?: boolean }) => {
      // Typed against the generated Update shape rather than
      // Record<string, unknown>: now that `profiles` is in database.ts, an
      // untyped payload is rejected, which is the generated types earning
      // their keep. A typo like `is_actve` is a compile error here.
      const patch: TablesUpdate<'profiles'> = {};
      if (role !== undefined) patch.role = role;
      if (isActive !== undefined) patch.is_active = isActive;

      const rows = await sb(
        profilesTable().update(patch).eq('id', id).select(PROFILE_COLUMNS)
      );
      return toProfile(affectedRow(rows, 'update') as unknown as ProfileRow);
    },
    ...mutationSideEffects(queryClient, queryKeys.profiles.all, callbacks),
  });
}
