# 00 — Findings that did not survive

**Ten of the original fifteen findings are recorded here rather than fixed.**
Three were refuted outright, four became obsolete when `main` moved, and three
are real but not worth acting on.

This file exists so none of them get re-raised. If a future review surfaces one
of these again, the answer is here.

## Method

Each finding was handed to an independent agent whose mandate was to **refute**
it, with a runnable reproduction required to survive. Findings were then
re-verified against `main` @ `83dd6b7` — the audit had run against `daee2ef`, and
`main` had since moved by 116 files and ~14.6k insertions.

That second step mattered: it invalidated four findings that had been correctly
confirmed hours earlier.

---

## Refuted on the evidence

### Hardcoded brand green in `AIAssistant.tsx`

**Claim:** the last hardcoded `rgba(26,61,43,0.1)` after everything else was
routed through `BRAND`, violating the "exactly two definitions" rule.

**Refuted.** The premise is false. There are **24** hardcoded occurrences of
`26,61,43` / `1a3d2b` outside `config/brand.ts` — concentrated in `Login.tsx`,
`MemorialPage.tsx`, `LocationsMap.tsx`, and `CemeteryMap.tsx` (which uses a raw
`#1a3d2b` hex, strictly worse than an rgba tint). Singling out one of 24 is
arbitrary.

Separately, the CLAUDE.md rule concerns **definitions of the token**, and both
still exist in exactly two places. A 10%-alpha tint is a usage, not a third
definition.

*If you want this:* it is a 24-site sweep and a decision about how to express
alpha-composited brand tints. That is a refactor, not a bug fix.

### `fetchAll`'s unconstrained `orderBy`

**Claim:** `orderBy: string` re-opens the runtime-400 class the typed Supabase
client was meant to close.

**Refuted as a defect; valid as hardening.** The runtime failure is real — a bad
column returns HTTP 400 from PostgREST, confirmed live. But it is **unreachable**:
all ten call sites pass columns verified to exist against
`information_schema.columns`, and `fetchAll` is **module-private** (not
exported). Writing the bad call requires editing `useData.ts` beside ten correct
examples.

*If you want this:* type it as
`keyof Database['public']['Tables'][T]['Row'] & string`. Cheap, no behaviour
change. Hardening, not a fix.

### Orphaned `paymentSchedule.all` query key

**Claim:** no invalidator remains after two hooks were deleted, so the payment
schedule pane serves stale data.

**Refuted three ways.** (1) There is **no writer at all** — the entire
payment-schedule surface is one read hook; no create/update/delete exists
anywhere in `src/`. Nothing a user does changes those rows. (2) The deleted hooks
had **zero callers** before removal, so removing them could not introduce
staleness. (3) The prefix-match argument is factually wrong: the key literal is
`['payment-schedule']`, not `['paymentSchedule']`, and it *does* prefix-match its
own `byContract` key under TanStack v5.

The key is dead code. Deleting it is tidy; it is not a staleness bug.

---

## Obsoleted by `main` moving

These were correctly confirmed against `daee2ef` and are **no longer true** at
`83dd6b7`. Recorded because the confirmation is in the audit trail and would
otherwise look unresolved.

| Finding | Status now |
|---|---|
| `CLAUDE.md` tells contributors to use the deleted `<Alert>` | **Already fixed** — line 128 now reads `<PageError>` |
| Dead `.skeleton` CSS with no consumer | **No longer dead** — the `Skeleton` component was reinstated at `ui.tsx:766` and uses the class |
| Orphaned `dmp-token` / `dmp-user` localStorage keys | **Moot** — `src/lib/demo-data.ts` no longer exists |
| `PageError` used by "seven pages" | Miscount — it is 8 pages plus `ui.tsx` |

The `<Alert>` one is worth a note. When it *was* live, it had survived **two
later commits that specifically edited CLAUDE.md**, one titled "correct the
docs." Doc rot is not caught by editing the doc; it is caught by making the claim
mechanically checkable.

---

## Real but not worth acting on

### `parseLocalDate` rolls over impossible dates

Confirmed behaviour — `formatDate('2026-02-30')` returns `"Mar 2, 2026"`;
`'2026-99-99'` returns `"Jun 7, 2034"`. `new Date(y, m-1, d)` normalises overflow
rather than producing `Invalid Date`, so the `Number.isNaN` guard never fires on
the date-only branch. (It *does* still fire for non-date input — `'not-a-date'`
returns `""` — so "never fires" was an overstatement.)

**Unreachable in practice.** Every date field is `type="date"`, which cannot emit
an out-of-range value, and the DB columns are Postgres `date`, which rejects one
at insert. The only vector is a hand-written JSONB `paymentPlan`, requiring
direct database manipulation.

Worth knowing: `dateStringSchema` would **not** catch it either —
`Date.parse('2026-02-30')` returns a number, not `NaN`. So there is no Zod
backstop if you were relying on one.

*If you want this:* after constructing the Date, assert its year/month/day match
the captured groups. Six lines, defensive.

### `process.env.TZ` set for every Vite invocation

Mechanism confirmed — the assignment is at module top level in `vite.config.ts`,
so `dev` and `build` inherit it, not just tests. **Both stated consequences are
wrong:**

- *"masks timezone bugs for developers outside Michigan"* — **false.**
  `formatDate` runs in the **browser**, whose timezone comes from the OS. A dev
  server's `process.env.TZ` cannot reach the client.
- *"builds under `TZ=America/Detroit`"* — true but inert. Nothing injects a
  build-time date; the emitted bundle is byte-identical either way.

Reduced to an imprecise comment: it says "for test runs" while the code is
unconditional. Reword the comment, or move the assignment into a Vitest
`globalSetup`.

---

## What this exercise cost and returned

Fifteen findings in, five actionable out. The three outright refutations and the
four staleness invalidations would each have become a wasted fix — and worse, a
confident commit message asserting a bug that was not there.

Two lessons worth keeping:

1. **A finding is a hypothesis until someone tries to kill it.** Every survivor
   here has a reproduction that was actually executed.
2. **Re-verify against current `HEAD` before writing anything down.** Four
   findings were true when confirmed and false four hours later.
