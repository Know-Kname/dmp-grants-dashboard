-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260502_payment_schedule.sql
-- Description: Creates payment_schedule table for contract installment tracking.
--              Extends contract_items with inventory_id FK and quantity column.
-- Author: Claude / Christian Hughes
-- Date: 2026-05-02
-- App Version: v2.0.0
-- Rollback SQL:
--   ALTER TABLE contract_items DROP COLUMN IF EXISTS inventory_id, DROP COLUMN IF EXISTS quantity;
--   DROP TABLE IF EXISTS payment_schedule CASCADE;
-- Dependencies: contracts table, inventory table, contract_items table
-- ═══════════════════════════════════════════════════════════════════
-- Step 2: payment_schedule table and contract_items extensions

CREATE TABLE IF NOT EXISTS payment_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','waived')),
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_contract ON payment_schedule(contract_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_due_date ON payment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_status ON payment_schedule(status);

ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON payment_schedule
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Extend contract_items with inventory link and quantity
ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_contract_items_inventory ON contract_items(inventory_id);
