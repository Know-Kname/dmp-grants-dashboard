-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260506013416_drop_template_tables.sql
-- Description: Removes three tables that were never part of the DMP product:
--                * public.flights, public.reviews — leftover Supabase tutorial
--                  scaffolding (created by 20260124040716, 20260124040723).
--                * public.users — redundant mirror of auth.users with no rows
--                  and no application reads. Three FKs reference it
--                  (work_orders.assigned_to, work_orders.created_by,
--                  deposits.created_by); CASCADE drops those constraints
--                  while leaving the columns intact. Future work may re-FK
--                  those columns to auth.users(id).
-- Author: Claude / Christian Hughes
-- Date: 2026-05-06
-- App Version: v2.0.0
-- Reversible:  Tables had 0 rows; recreate via Supabase Dashboard if needed.
-- ═══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.flights CASCADE;
DROP TABLE IF EXISTS public.users   CASCADE;
