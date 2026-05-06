-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260502_burial_memorial_published.sql
-- Description: Adds memorial_published boolean to burials table so staff can
--              publish individual memorial pages accessible via public QR code.
--              Creates anon_memorial_read RLS policy for /memorial/:id route.
-- Author: Claude / Christian Hughes
-- Date: 2026-05-02
-- App Version: v2.0.0
-- Rollback SQL:
--   DROP POLICY IF EXISTS "anon_memorial_read" ON burials;
--   DROP INDEX IF EXISTS idx_burials_memorial;
--   ALTER TABLE burials DROP COLUMN IF EXISTS memorial_published;
-- Dependencies: burials table must exist with RLS enabled
-- ═══════════════════════════════════════════════════════════════════
-- Step 4: Add memorial_published flag to burials for public QR pages

ALTER TABLE burials ADD COLUMN IF NOT EXISTS memorial_published boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_burials_memorial ON burials(memorial_published)
  WHERE memorial_published = true;

-- Allow anonymous reads of published memorials only
-- Drop first if exists so migration is idempotent
DROP POLICY IF EXISTS "anon_memorial_read" ON burials;

CREATE POLICY "anon_memorial_read" ON burials
  FOR SELECT TO anon USING (memorial_published = true);
