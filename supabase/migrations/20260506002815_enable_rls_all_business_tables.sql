-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260506002815_enable_rls_all_business_tables.sql
-- Description: Enables Row Level Security on all 12 business tables that were
--              created without RLS, and adds an `auth_all` policy granting
--              authenticated staff full read/write access. Anon role gains no
--              access except where a separate policy permits it (e.g. burials
--              memorial_published, see 20260506002800_burial_memorial_published).
--
--              Reconstructed locally on 2026-05-06 to match the ledger entry
--              applied via Supabase MCP earlier the same day. Faithfully
--              records the SQL as it was applied — including `public.users`,
--              which was subsequently dropped by 20260506013416_drop_template_tables.
-- Author: Claude / Christian Hughes
-- Date: 2026-05-06
-- App Version: v2.0.0
-- Trust model: All authenticated users are equally trusted DMP staff. The
--              `auth_all USING(true) WITH CHECK(true)` pattern is intentional
--              for an internal-only staff tool. Per-role policies (admin/staff/
--              read-only) can be layered on later if/when the trust model changes.
-- Rollback SQL:
--   DROP POLICY IF EXISTS auth_all ON public.users;
--   ALTER  TABLE public.users DISABLE ROW LEVEL SECURITY;
--   -- (repeat per table)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.burials               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grants                ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all ON public.users               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.customers           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.vendors             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.work_orders         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.inventory           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.deposits            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.accounts_receivable FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.accounts_payable    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.burials             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.contracts           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.contract_items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.grants              FOR ALL TO authenticated USING (true) WITH CHECK (true);
