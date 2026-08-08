# Defect Runbooks

Each runbook is **self-contained**: it assumes you are starting a fresh session
with no memory of how it was written. Fix one at a time, on its own branch.

Root `RUNBOOK.md` covers operations. These cover defects.

## Provenance — read this first

These came from a `/code-review` pass that produced **15 findings**. Every one
was then handed to an independent agent whose mandate was to **refute** it, with
a runnable reproduction required to survive. Findings were then re-verified
against `main` at **`83dd6b7`**, because the audit had run against the older
`daee2ef` and `main` had moved by 116 files.

**Ten of the fifteen did not survive.** That is the point of the exercise, not a
failure of it — see [00-not-actionable.md](00-not-actionable.md), which records
every rejected finding and why, so none of them get re-raised.

## Findings

Five of the seven are fixed. Two remain, neither reachable today.

| # | Runbook | Severity | Exposure today |
|---|---|---|---|
| ~~01~~ | [contracts-total-amount](01-contracts-total-amount.md) | ~~High~~ | ✅ **Fixed** — `a750828` (PR #96) |
| 02 | [contracts-line-item-deletion](02-contracts-line-item-deletion.md) | Medium | Blocks on first use — 0 rows |
| ~~03~~ | [financial-invoice-status](03-financial-invoice-status.md) | ~~High~~ | ✅ **Fixed** — was latent; AR/AP at 0 rows |
| ~~04~~ | [workorder-status-unreachable](04-workorder-status-unreachable.md) | ~~High~~ | ✅ **Fixed** — headline was stale; two narrower gaps closed |
| ~~05~~ | [useform-stale-errors](05-useform-stale-errors.md) | ~~Low (cosmetic)~~ | ✅ **Fixed** — was live on Customers and Burials |
| 06 | [useform-latent-defects](06-useform-latent-defects.md) | Low | Dormant — no consumer triggers them |
| ~~07~~ | [modal-focus-trap](07-modal-focus-trap.md) | ~~High~~ | ✅ **Fixed** — was live in every modal, app-wide |

## Runbook 07 was held to a lower standard — that no longer applies

07 was originally written up as **unverified**: its mechanism was confirmed in
jsdom only, circumstantial evidence was read as arguing against it reproducing in
a browser, and its first step was a reproduction rather than a fix.

**The reproduction was done and the bug is real.** Confirmed in real Chromium via
Playwright: one character landed per modal field, at any typing speed, with focus
jumping to the dialog container. Severity **High** — every modal in the app, and
unlike 02–06 it was **live**, not latent, because it needed no particular table
to have rows in it. It is now fixed and verified; 07 is held to the same standard
as the rest.

The lesson is in the doubt, not the bug. The reason 07 was downgraded was
"production has ~1,575 rows, someone would have noticed" — and 100% of those rows
turned out to be bulk imported. See the section below.

## Context that reframes every severity here

**This app has almost no hand-entry usage history.** Contracts, AR, AP, work
orders, inventory, and payment schedule are all at **zero rows**. The only
populated tables — burials (796) and customers (779) — are **100% bulk imported**
(`source_system = 'dim_party_dmp_west'`, via `scripts/import/load.py`).

Two consequences worth holding onto:

1. **Nothing here is corrupting live data today.** Every defect blocks or
   corrupts on first real use, which has not happened yet. That is a window to
   fix them, not a reason to deprioritise.
2. **"Surely someone would have noticed" is not available as evidence.** Nobody
   has exercised these paths. That argument was used to downgrade runbook 07 and
   turned out to be worthless — 07 was real, High, and live in every modal in the
   app. Check row provenance before leaning on it again.

One caveat on point 1, learned from 07: "zero rows" bounds defects in *table-
specific write paths*. It says nothing about defects in shared UI, which are live
the moment anyone opens the app. 07 was in `ui.tsx` and no row count could have
predicted its exposure.

## The counterintuitive priority

Severity and urgency disagree here, and it is worth being explicit about why.

Runbooks 01–04 are the severe ones, and every table they touch has **zero rows**
in production. They are not corrupting anything; they will block or corrupt the
first time someone genuinely uses those modules.

Runbook 05 is *cosmetic* and is one of only two anyone could hit **today**,
because Customers (779 rows) and Burials (796 rows) are in active use.

Runbook 07 was the other, and it inverted the whole framing: it lived in shared
UI, so no table needed rows for it to bite. It was both the most severe finding
and the most immediately reachable one — and it was the one written up as
"unverified".

~~Fix 01 before anyone tries to write a contract.~~ Done — `a750828`.
~~Fix 07 before anyone types into anything.~~ Done.
~~Fix 05 next: it is the only remaining finding anyone can encounter today.~~ Done.

Nothing open is reachable today. 02 (Medium) and 06 (dormant) both wait on
tables at zero rows.

**A runbook is a snapshot, not a standing truth.** 04's headline — "a work order
can never leave pending" — was already false by the time it was fixed: a board
view with Start/Complete quick actions had landed in between. Re-verify every
premise against current `main` before writing a test, or you will write one that
passes against a bug that no longer exists and "fix" nothing. This has now bitten
twice: 05 wrongly called Contracts immune, and 04 overstated its own scope.

## Shared root cause

01, 03, 04, and 05 all trace to the same process failure, documented once in each
runbook's *Why it shipped* section: **a bulk conversion applied a pattern
uniformly without re-checking each site's contract.** The Zod/`useForm`
conversion assumed every form field was unconditionally required; the payload
rewrites enumerated fields by hand and silently dropped ones the UI never
exposed. No test covered a form's *submit gate*, only its schema in isolation.

That is the finding worth carrying forward. The individual bugs are cheap; the
pattern that produced four of them is not.

## Verification standard

No runbook is complete until its regression test has been observed **failing**
against unfixed `main`. A test that passes either way tests nothing, and is the
most common defect in test additions.
