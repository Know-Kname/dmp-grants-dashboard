-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260502_cemetery_hierarchy.sql
-- Description: Creates 4-level cemetery hierarchy (Cemetery→Section→Lot→Grave)
--              and links burials to structured plot data via grave_id FK.
-- Author: Claude / Christian Hughes
-- Date: 2026-05-02
-- App Version: v2.0.0
-- Rollback SQL:
--   ALTER TABLE burials DROP COLUMN IF EXISTS grave_id;
--   DROP TABLE IF EXISTS graves, lots, sections, cemeteries CASCADE;
-- Dependencies: burials table must exist
-- ═══════════════════════════════════════════════════════════════════
-- Step 3: Cemetery hierarchy tables and burial grave_id link

CREATE TABLE IF NOT EXISTS cemeteries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capacity integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  lot_number text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS graves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  grave_number text NOT NULL,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','reserved','occupied','unavailable')),
  lat numeric(10,7),
  lng numeric(10,7),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sections_cemetery ON sections(cemetery_id);
CREATE INDEX IF NOT EXISTS idx_lots_section ON lots(section_id);
CREATE INDEX IF NOT EXISTS idx_graves_lot ON graves(lot_id);
CREATE INDEX IF NOT EXISTS idx_graves_status ON graves(status);

-- Link burials to structured plot data (nullable; backfill over time)
ALTER TABLE burials ADD COLUMN IF NOT EXISTS grave_id uuid REFERENCES graves(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_burials_grave ON burials(grave_id);

-- RLS for all four tables
ALTER TABLE cemeteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE graves     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON cemeteries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON sections   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON lots       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON graves     FOR ALL TO authenticated USING (true) WITH CHECK (true);
