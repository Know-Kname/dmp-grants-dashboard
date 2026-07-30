-- Remove the 131 legacy rows that are the only data in this database.
--
-- These are NOT vendor invoices. They are 2020-2022 credit-card and bank
-- expense lines loaded during an early experiment: the top "vendors" are
-- US Bank, Amex CC, Speedway and BP OIL, alongside outright non-vendors
-- (Capital Grille, Five Guys, Hertz, "Points Redeemed For Statement Credit"),
-- garbled strings ("Contactors NAT LAD", "Jaxkarwash", "Vzwrlss") and
-- single-character rows ("TM", "U", "W"). Leaving them in place would seed
-- the real import with a vendor list that is mostly noise.
--
-- Both tables were archived to CSV before this ran and the archive ties out
-- exactly to the database (90 AP rows, sum(amount) = 308342.72,
-- sum(amount_paid) = 156336.74; 41 vendors):
--   docs/legacy/2026-07-30_accounts_payable_pre_wipe.csv
--   docs/legacy/2026-07-30_vendors_pre_wipe.csv
--   docs/legacy/README.md   <- what was mined out of them and what to keep
--
-- Safe to wipe: every row is re-derivable from the Silver vendor workbook,
-- and the genuinely useful content (the American Eagle vault payables, plus
-- Jett Pump & Valve and Elavon) is recorded in the archive README.
--
-- DELETE rather than TRUNCATE deliberately: `inventory` also references
-- `vendors`, and TRUNCATE would demand CASCADE. CASCADE silently empties
-- whatever it reaches, which is exactly the wrong default for a wipe.
-- DELETE respects the foreign keys and fails loudly if anything still
-- points at a row being removed.

delete from public.accounts_payable;
delete from public.vendors;
