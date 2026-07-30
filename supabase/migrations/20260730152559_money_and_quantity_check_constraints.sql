-- Money and quantity sanity checks.
--
-- Every status column already had a CHECK constraint. No amount column had
-- one, so nothing stopped a negative invoice or a payment larger than the
-- invoice it pays -- both of which silently corrupt an aging report rather
-- than failing visibly.
--
-- Added NOT VALID then VALIDATE as a deliberate habit: on these empty tables
-- the two-step is equivalent to a plain ADD CONSTRAINT, but at 39K burials
-- and a full ledger it is the difference between a brief ACCESS EXCLUSIVE
-- lock and a full-table scan holding one.
--
-- Deposits get `<> 0` rather than `> 0`: a zero-amount deposit is always a
-- junk row, but a negative one is a legitimate correcting entry and a
-- constraint that blocks a reversal is a constraint staff will ask to have
-- removed.

alter table public.accounts_payable
  add constraint accounts_payable_amount_non_negative check (amount >= 0) not valid,
  add constraint accounts_payable_amount_paid_non_negative check (amount_paid >= 0) not valid,
  add constraint accounts_payable_amount_paid_lte_amount check (amount_paid <= amount) not valid;

alter table public.accounts_receivable
  add constraint accounts_receivable_amount_non_negative check (amount >= 0) not valid,
  add constraint accounts_receivable_amount_paid_non_negative check (amount_paid >= 0) not valid,
  add constraint accounts_receivable_amount_paid_lte_amount check (amount_paid <= amount) not valid;

alter table public.contracts
  add constraint contracts_total_amount_non_negative check (total_amount >= 0) not valid,
  add constraint contracts_amount_paid_non_negative check (amount_paid >= 0) not valid,
  add constraint contracts_amount_paid_lte_total check (amount_paid <= total_amount) not valid;

alter table public.contract_items
  add constraint contract_items_amount_non_negative check (amount >= 0) not valid,
  add constraint contract_items_quantity_positive check (quantity > 0) not valid;

alter table public.payment_schedule
  add constraint payment_schedule_amount_non_negative check (amount >= 0) not valid;

alter table public.deposits
  add constraint deposits_amount_non_zero check (amount <> 0) not valid;

alter table public.grants
  add constraint grants_amount_non_negative check (amount is null or amount >= 0) not valid;

alter table public.inventory
  add constraint inventory_quantity_non_negative check (quantity >= 0) not valid,
  add constraint inventory_reorder_point_non_negative check (reorder_point >= 0) not valid,
  add constraint inventory_unit_price_non_negative check (unit_price >= 0) not valid;

-- Dates that cannot be in that order regardless of source-system quirks.
alter table public.burials
  add constraint burials_death_after_birth
    check (date_of_birth is null or date_of_death is null or date_of_death >= date_of_birth) not valid;

alter table public.accounts_payable validate constraint accounts_payable_amount_non_negative;
alter table public.accounts_payable validate constraint accounts_payable_amount_paid_non_negative;
alter table public.accounts_payable validate constraint accounts_payable_amount_paid_lte_amount;
alter table public.accounts_receivable validate constraint accounts_receivable_amount_non_negative;
alter table public.accounts_receivable validate constraint accounts_receivable_amount_paid_non_negative;
alter table public.accounts_receivable validate constraint accounts_receivable_amount_paid_lte_amount;
alter table public.contracts validate constraint contracts_total_amount_non_negative;
alter table public.contracts validate constraint contracts_amount_paid_non_negative;
alter table public.contracts validate constraint contracts_amount_paid_lte_total;
alter table public.contract_items validate constraint contract_items_amount_non_negative;
alter table public.contract_items validate constraint contract_items_quantity_positive;
alter table public.payment_schedule validate constraint payment_schedule_amount_non_negative;
alter table public.deposits validate constraint deposits_amount_non_zero;
alter table public.grants validate constraint grants_amount_non_negative;
alter table public.inventory validate constraint inventory_quantity_non_negative;
alter table public.inventory validate constraint inventory_reorder_point_non_negative;
alter table public.inventory validate constraint inventory_unit_price_non_negative;
alter table public.burials validate constraint burials_death_after_birth;
