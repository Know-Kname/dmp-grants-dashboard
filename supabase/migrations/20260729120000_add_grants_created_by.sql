-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260729120000_add_grants_created_by.sql
-- Description: Adds the created_by column the application already writes to
--              grants. useCreateGrant has been inserting created_by since the
--              hook was authored, but the column was never added, so every
--              grant insert failed with:
--                  column "created_by" of relation "grants" does not exist
--              This makes grant creation work; it is a bug fix, not a feature.
-- Author: Claude / Christian Hughes
-- Date: 2026-07-29
-- App Version: v2.0.0
-- Rollback SQL:
--   ALTER TABLE grants DROP COLUMN IF EXISTS created_by;
-- Dependencies: grants table must exist
-- Notes:
--   * Shape deliberately matches the existing work_orders.created_by and
--     deposits.created_by columns exactly: nullable uuid, no default, and no
--     foreign key to auth.users. Those two are the established convention, and
--     adding a constraint here alone would make three identical-looking columns
--     behave differently. Adding referential integrity is worth doing, but as a
--     deliberate change across all three rather than a side effect of this fix.
--   * Nullable is required, not incidental: the client omits created_by when
--     there is no authenticated user (demo/anon sessions) rather than writing a
--     placeholder, so inserts must be allowed to leave it NULL.
--   * grants is empty at time of writing, so there is no backfill and no lock
--     concern.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE grants ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN grants.created_by IS
  'auth.users.id of the staff member who created this row. NULL for records created without an authenticated session.';
