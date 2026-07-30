-- Validate two CHECK constraints left NOT VALID by the preceding migration.
--
-- `accounts_payable_amount_non_zero` and `accounts_receivable_amount_non_zero`
-- were added `not valid` and the matching VALIDATE statements were never
-- written. A NOT VALID constraint is enforced for new writes but NOT checked
-- against existing rows -- so the schema claimed a guarantee it was not
-- actually providing for anything already in the table.
--
-- Caught by the standing post-migration assertion
--   select count(*) from pg_constraint
--   where connamespace='public'::regnamespace and contype='c' and not convalidated;
-- which is exactly why that assertion is worth running every time rather than
-- trusting that apply_migration returning success means the migration was
-- complete. "Success" means the SQL parsed and committed, nothing more.
--
-- Cheap here (both tables are empty). On a loaded table this is the scan that
-- the NOT VALID / VALIDATE split exists to keep out of the exclusive lock --
-- which only works when VALIDATE runs in its own transaction, as it does here.

alter table public.accounts_payable validate constraint accounts_payable_amount_non_zero;
alter table public.accounts_receivable validate constraint accounts_receivable_amount_non_zero;
