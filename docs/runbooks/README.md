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

## Live findings

| # | Runbook | Severity | Exposure today |
|---|---|---|---|
| 01 | [contracts-total-amount](01-contracts-total-amount.md) | **High** | Blocks on first use — `contracts` has 0 rows |
| 02 | [contracts-line-item-deletion](02-contracts-line-item-deletion.md) | Medium | Blocks on first use — 0 rows |
| 03 | [financial-invoice-status](03-financial-invoice-status.md) | High | Latent — AR/AP have 0 rows |
| 04 | [workorder-status-unreachable](04-workorder-status-unreachable.md) | High | Latent — 0 rows |
| 05 | [useform-stale-errors](05-useform-stale-errors.md) | Low (cosmetic) | **Live now** — Customers 779 rows, Burials 796 rows |
| 06 | [useform-latent-defects](06-useform-latent-defects.md) | Low | Dormant — no consumer triggers them |

## The counterintuitive priority

Severity and urgency disagree here, and it is worth being explicit about why.

Runbooks 01–04 are the severe ones, and every table they touch has **zero rows**
in production. They are not corrupting anything; they will block or corrupt the
first time someone genuinely uses those modules.

Runbook 05 is *cosmetic* and is the only one users can hit **today**, because
Customers (779 rows) and Burials (796 rows) are in active use.

Fix 01 before anyone tries to write a contract. Fix 05 because people are looking
at it right now.

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
