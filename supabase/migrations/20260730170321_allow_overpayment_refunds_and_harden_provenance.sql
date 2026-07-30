-- Corrects two mistakes in the preceding Phase 1 migrations.
--
-- PART A: the money constraints were too strict for how this business
-- actually takes money.
--
-- `amount_paid <= amount` and `amount >= 0` together made three routine
-- deathcare situations unrepresentable:
--   * Overpayment. Insurance assignment routinely pays more than the
--     invoice; families round up; a check and a card payment both land.
--   * Refunds. `amount_paid >= 0` forbids recording money going back out.
--   * Credit memos. `amount >= 0` forbids a negative invoice, which is the
--     standard instrument for a pre-need cancellation refund.
--
-- Worse, the failure was ugly as well as wrong: the two payment-recording
-- forms in Financial.tsx have no Zod schema, so a staff member entering
-- $1,200 against a $1,000 invoice got the raw text
-- "violates check constraint accounts_receivable_amount_paid_lte_amount"
-- in a toast.
--
-- Keeping only the constraints that catch genuine data corruption rather
-- than unusual-but-legitimate business events. Over/under payment is now a
-- client-side warning, not a database refusal.

alter table public.accounts_payable
  drop constraint if exists accounts_payable_amount_paid_lte_amount,
  drop constraint if exists accounts_payable_amount_non_negative,
  drop constraint if exists accounts_payable_amount_paid_non_negative;

alter table public.accounts_receivable
  drop constraint if exists accounts_receivable_amount_paid_lte_amount,
  drop constraint if exists accounts_receivable_amount_non_negative,
  drop constraint if exists accounts_receivable_amount_paid_non_negative;

alter table public.contracts
  drop constraint if exists contracts_amount_paid_lte_total,
  drop constraint if exists contracts_total_amount_non_negative,
  drop constraint if exists contracts_amount_paid_non_negative;

alter table public.contract_items
  drop constraint if exists contract_items_amount_non_negative;

-- A zero-value invoice or line is always a data error, whichever sign the
-- real amount has. This is the part worth enforcing.
alter table public.accounts_payable
  add constraint accounts_payable_amount_non_zero check (amount <> 0) not valid;
alter table public.accounts_receivable
  add constraint accounts_receivable_amount_non_zero check (amount <> 0) not valid;

-- Inventory and payment schedule keep their non-negative checks: negative
-- stock or a negative scheduled instalment are corruption, not business.
-- `contract_items_quantity_positive` also stays.

-- PART B: close the two provenance holes found by testing the constraint
-- rather than trusting the DDL.
--
-- Hole 1 -- empty strings. ('','') satisfies
-- `(source_system IS NULL) = (source_ref IS NULL)` and gets indexed, so a
-- loader emitting '' for a blank key column produces a row that claims to
-- be imported, tracks back to nothing, and consumes the one unique slot
-- for ('',''), after which every subsequent such row fails with a
-- confusing 23505.
--
-- Hole 2 -- case and whitespace. Verified against the live database:
-- ('test','A1') and ('test','a1') insert as two distinct rows. So does
-- ('cemsites','X') vs ('CemSites','X'). A re-run of an import with a
-- differently-cased source_system literal duplicates the entire load
-- instead of updating it -- precisely the failure the unique index exists
-- to prevent.
--
-- Fixing by forcing a canonical form at write time and failing loudly,
-- rather than by indexing lower(source_ref) -- some source systems do use
-- case-significant keys, and silently folding them would trade a
-- duplicate-import bug for a merged-records bug, which is worse in a
-- system where the records are interments.

do $$
declare t text;
begin
  foreach t in array array[
    'accounts_payable','accounts_receivable','burials','cemeteries',
    'contract_items','contracts','customers','deposits','grants','graves',
    'inventory','lots','payment_schedule','sections','vendors','work_orders'
  ]
  loop
    execute format(
      'alter table public.%I add constraint %I check (
         source_system is null or (
           source_system <> '''' and source_ref <> ''''
           and source_system = lower(btrim(source_system))
           and source_ref = btrim(source_ref)
         )) not valid', t, t || '_source_canonical');
    execute format('alter table public.%I validate constraint %I', t, t || '_source_canonical');
  end loop;
end $$;

comment on constraint accounts_payable_source_canonical on public.accounts_payable is
  'source_system must be lowercase and trimmed, source_ref trimmed, neither empty. Forces one canonical spelling per source so ON CONFLICT actually matches on re-import.';
