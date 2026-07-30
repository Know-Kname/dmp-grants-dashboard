-- Migration: add_covering_indexes_for_unindexed_fks
-- Version:   20260523232936
--
-- RECOVERED MIGRATION. This migration was applied directly to the production
-- Supabase project (mgpwjnxtqcnoyjgebytg) but the file was never committed, so
-- `supabase db reset` from this repo produced a schema in which every one of
-- these foreign-key joins sequential-scans.
--
-- The body below is the verbatim DDL read back out of
-- supabase_migrations.schema_migrations.statements for version 20260523232936
-- on the production project, so applying this file reproduces exactly what
-- production already has. Because production has this version recorded as
-- already applied, committing the file is a no-op there — it only repairs
-- fresh/local resets. The statements were already idempotent
-- (`create index if not exists`), so re-running is safe either way.
--
-- Indexes cover the FKs the Supabase performance advisor flagged as unindexed:
--   contract_items.contract_id -> contracts.id
--   deposits.customer_id      -> customers.id
--   inventory.vendor_id       -> vendors.id
--
-- The remaining FKs in the schema are already covered elsewhere:
--   burials.grave_id, graves.lot_id, lots.section_id, sections.cemetery_id
--     -> 20260506002740_cemetery_hierarchy.sql
--   payment_schedule.contract_id, contract_items.inventory_id
--     -> 20260506002753_payment_schedule.sql
--   accounts_payable.vendor_id (idx_ap_vendor),
--   accounts_receivable.customer_id (idx_ar_customer),
--   contracts.customer_id (idx_contracts_customer)
--     -> created by the original base schema, which was authored in the
--        Supabase dashboard and likewise has no migration file in this repo.
--        See docs/13-ci-and-database-operations.md ("Known divergence").

-- Covering indexes for foreign keys flagged by the performance advisor
CREATE INDEX IF NOT EXISTS idx_contract_items_contract_id ON public.contract_items (contract_id);
CREATE INDEX IF NOT EXISTS idx_deposits_customer_id ON public.deposits (customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_vendor_id ON public.inventory (vendor_id);
