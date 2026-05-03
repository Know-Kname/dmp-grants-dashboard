-- Step 4: Add memorial_published flag to burials for public QR pages

ALTER TABLE burials ADD COLUMN IF NOT EXISTS memorial_published boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_burials_memorial ON burials(memorial_published)
  WHERE memorial_published = true;

-- Allow anonymous reads of published memorials only
-- Drop first if exists so migration is idempotent
DROP POLICY IF EXISTS "anon_memorial_read" ON burials;

CREATE POLICY "anon_memorial_read" ON burials
  FOR SELECT TO anon USING (memorial_published = true);
