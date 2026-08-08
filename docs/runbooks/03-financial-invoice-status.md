# 03 — Recording a payment never clears an invoice's status

**Severity:** High · **Status:** ✅ **Fixed** — see *Resolution* · **Exposure when open:** `accounts_receivable` = 0 rows, `accounts_payable` = 0 rows. Latent; would have corrupted from the first invoice onward.

## Summary

A fully-paid invoice keeps `status = 'pending'` forever. It renders **Balance
$0.00 next to a Pending badge**, and a nightly cron later flips it to
**`overdue`** — permanently, because nothing can move it back.

## Reproduction

1. Financial → create a receivable for $1,000
2. Click the pencil, enter `1000` as Amount Paid, save
3. The row shows Balance $0.00 and a **Pending** badge
4. After `due_date` passes, the 01:00 UTC cron sets it to **Overdue**
5. The Dashboard "overdue" tile now counts a fully-paid invoice, permanently

Identical for payables.

## Root cause

`src/pages/Financial.tsx:282-285` (and `:291-294` for payables):

```ts
receivableUpdateMutation.mutate({
  id: editingReceivable.id,
  amountPaid: parseFloat(receivableEditForm.amountPaid) || 0,
});
```

No `status`. The edit modal renders exactly one control — Amount Paid. There is
no status control anywhere on the page.

`useUpdateReceivable` / `useUpdatePayable` **accept** `status?: string`. No
caller passes it. Repo-wide, no code path sets an invoice to `paid` or
`partial`; the only references are read filters.

**Nothing downstream compensates — verified against the live database:**

- `status` on both tables: `character varying`, `NOT NULL`, `column_default = null`, `is_generated = NEVER`
- Complete trigger list on both tables: `set_updated_at` only. Nothing touches `status`.
- Full `public` function inventory contains nothing referencing AR/AP status.
- `CHECK` constraint permits `pending | partial | paid | overdue` — `'paid'` is legal and simply never written.

**The cron is live, contradicting its own migration header.** The migration says
*"STATUS: PENDING — awaiting pg_cron activation"*, but `pg_cron` is installed and
`cron.job` holds three **active** jobs, including:

```sql
-- mark-overdue-ar, 0 1 * * *, active = true
UPDATE accounts_receivable SET status = 'overdue'
WHERE status IN ('pending','partial') AND due_date < CURRENT_DATE
```

Do not trust that header. Query `cron.job` directly.

## What is *not* broken

The dollar aggregates are safe. `Financial.tsx` and `Dashboard.tsx` filter
`status !== 'paid'` but reduce over `amount - amountPaid`, which is `0` for a
paid invoice — so outstanding and due totals are correct.

The damage is confined to **badges, status counts, and the overdue tile**
(`Dashboard.tsx` — `receivables.filter(r => r.status === 'overdue').length`).

Partial payments are also mislabelled: they stay `pending` and never become
`partial`, so that CHECK-permitted state is unreachable too.

## Why it shipped

The create path was fixed during this session by hardcoding
`status: 'pending'` to satisfy a `NOT NULL` column with no default. That made
creation work and simultaneously made this gap **reachable** — before the fix,
creation failed outright, so nobody got far enough to record a payment.

Fixing the insert without asking *"what advances this column afterwards?"* is the
root error. The status lifecycle was never modelled; only its initial value was.

## Fix options

**A — derive status in the application on payment (recommended for now).**
Compute from `amountPaid` vs `amount` at the mutation call site:
`paid` when `amountPaid >= amount`, `partial` when `> 0`, else leave `pending`.
Smallest change, keeps the logic visible, no migration. Weakness: any future
writer must remember it.

**B — a database trigger on `BEFORE UPDATE`.** Cannot be bypassed by any client
and fixes every future writer at once. Heavier, needs a migration, and puts
business logic in the DB — but this *is* a data-integrity invariant, which is
exactly what belongs there.

**C — a generated column.** Rejected: `status` also holds `overdue`, which
depends on `due_date` and the clock, so it is not a pure function of the other
columns.

Take **A** now for speed; **B** is the durable answer and should follow. Whatever
you choose, also ensure the cron cannot re-flag a paid invoice — its `WHERE
status IN ('pending','partial')` already excludes `paid`, so fixing the write is
sufficient.

## Verification

Regression test that **must fail first**: assert the update mutation is called
with `status: 'paid'` when the full amount is entered, and `status: 'partial'`
for a partial payment.

Then, against a scratch row: insert an invoice, record full payment, and
`SELECT status FROM accounts_receivable WHERE id = ...` — expect `paid`. Confirm
the Dashboard overdue count excludes it after the cron would have run.

## Prevention

Any `NOT NULL` status column needs its **whole lifecycle** written down — who
sets each value, and on what event — before the create path ships. A create fix
that hardcodes an initial value is only half the work.

## Blast radius

Same pattern in `work_orders` — runbook 04. Check `deposits` and
`payment_schedule` for status columns with no advancing writer.

## Not in scope

The `mark-overdue-schedule` cron job and `payment_schedule` generally — no
app-side writer exists for that table at all.

---

## Resolution

Fixed by **option A**, with the rule given a name rather than left inline.

**Premises re-verified before fixing** — this was written against `83dd6b7` and
`main` had moved seven merges:

- `Financial.tsx:312` and `:321` still sent `{ id, amountPaid }` and no status.
- All three cron jobs are **still active** — `mark-overdue-ar`,
  `mark-overdue-ap`, `mark-overdue-schedule`, each `0 1 * * *`, queried from
  `cron.job` rather than trusting the migration header, which still says
  "awaiting pg_cron activation".
- The CHECK constraint still permits `pending | partial | paid | overdue` on
  both tables.

### What was implemented

`src/lib/invoiceStatus.ts` — `paymentStatus(amountPaid, amount)`:

| Condition | Result |
|---|---|
| `amount > 0 && amountPaid >= amount` | `paid` |
| `amountPaid > 0` | `partial` |
| otherwise | `pending` |

It lives in `lib/` rather than inline so the rule has a name, a test, and one
place to change — the runbook's stated weakness of option A was "any future
writer must remember it", and a named import is harder to forget than a literal.

**It never returns `overdue`,** which is deliberate. That state depends on
`due_date` and the clock, not the amounts, and the cron owns it. The interaction
is self-correcting: a partial payment on an overdue invoice returns `partial`,
and the next cron run re-flags it because `WHERE status IN ('pending','partial')`
still matches. Settling it fully returns `paid`, which that clause excludes — so
a paid invoice can never be dragged back to overdue.

The degenerate case is guarded explicitly: with a zero or negative total,
`amountPaid >= amount` would otherwise call an untouched invoice "paid".

### Coverage

Four tests in `src/pages/Financial.test.tsx`, all observed **failing first** with
`status` absent from the mutation: full payment → `paid`, partial → `partial`,
zero → `pending`, and overpayment → `paid` rather than an invented state.

### Still outstanding

**Option B — the database trigger — was not done.** The runbook is right that it
is the durable answer: this is a data-integrity invariant and belongs in the
database, where no client can bypass it. The application fix closes the live
path; the trigger would close the class. Worth doing when the journey-test
harness with a local database exists, since that is what would verify it.
