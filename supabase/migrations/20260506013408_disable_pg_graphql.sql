-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260506013408_disable_pg_graphql.sql
-- Description: Drops the auto-GraphQL extension. The application uses
--              PostgREST exclusively via @supabase/supabase-js — verified
--              with a full src/ grep for "graphql"/"gql" returning zero
--              hits. Disabling pg_graphql eliminates the entire GraphQL
--              attack surface and removes 38 advisor warnings (anon and
--              authenticated table exposure across all 19 public tables).
-- Author: Claude / Christian Hughes
-- Date: 2026-05-06
-- App Version: v2.0.0
-- Reversible: CREATE EXTENSION pg_graphql;
-- ═══════════════════════════════════════════════════════════════════

DROP EXTENSION IF EXISTS pg_graphql CASCADE;
