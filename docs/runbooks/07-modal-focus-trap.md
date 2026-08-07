# 07 — Modal focus trap may steal focus between keystrokes

**Severity:** Unknown — **plausibly High** · **Status:** ⚠️ **UNVERIFIED IN A REAL BROWSER** · **Found:** while writing tests for runbook 01, not by the original review.

## Read this first

This runbook is **not** at the same evidence standard as 01–06. Those were each
reproduced and independently re-verified. This one has a confirmed mechanism in
**jsdom only**, and there is strong circumstantial evidence it does *not*
reproduce in a real browser.

**Do not fix this until it is reproduced against a running app.** Step 1 below is
that reproduction. If it does not reproduce, close this runbook as jsdom-only
and note it in `00-not-actionable.md`.

The initial write-up argued this was probably jsdom-only because production has
~1,575 rows that "must have been typed in." That turned out to be false — see
below. The doubt has narrowed considerably.

## The mechanism

`Modal` in `src/components/ui.tsx` keys its focus-trap `useEffect` on `onClose`.
Every page passes that prop **unmemoised** — an inline arrow re-created on each
render. So the effect's dependency changes every render, tearing down and
re-running the effect, and its cleanup calls `previous?.focus()`.

The consequence in jsdom: focus is pulled off the active input between
keystrokes. `userEvent.type` registered only the first character.

## The circumstantial defence has collapsed — treat this as plausible

The original reasoning was: 779 customers and 796 burials exist in production, so
if modals dropped keystrokes somebody would have noticed.

**That argument is dead.** Every one of those rows was bulk imported:

```sql
SELECT source_system, count(*) FROM burials  GROUP BY 1;  -- dim_party_dmp_west | 796
SELECT source_system, count(*) FROM customers GROUP BY 1;  -- dim_party_dmp_west | 779
```

100% of both tables came through `scripts/import/load.py`, not the UI. **Nobody
has typed into these modals at scale.** Every other table — contracts, AR, AP,
work orders, inventory, payment schedule — is at zero rows.

So the app has effectively **no hand-entry usage history at all**, and the
absence of complaints is evidence of nothing.

Two possibilities remain, and only a browser test separates them:

1. **jsdom-only.** React batching, `flushSync`, and real focus-event ordering
   differ from jsdom's synchronous model. Still entirely possible.
2. **Real and simply unencountered**, because the first person to do sustained
   data entry has not done it yet.

Given the blast radius — every modal in the app — option 2 is worth ruling out
before anyone starts entering contracts or work orders by hand.

## How it was found

Not by review, and not by looking at `ui.tsx`. Writing a DOM test for runbook 01,
`userEvent.type` registered only the first character. An isolated `useForm` +
`Input` harness typed correctly, which localised the fault to the modal wrapper.

Worth noting as a method: the bug was found by a test failing *for the wrong
reason*. A test that fails unexpectedly is evidence about the system, not just an
obstacle to route around — the temptation to switch to `fireEvent` and move on
would have buried it.

## Reproduction to attempt (step 1 — do this first)

1. `npm run dev`
2. Open any page with a modal — Customers is the highest-traffic one
3. Click **New Customer**
4. Type a multi-character name **at normal speed** into First Name
5. Observe whether every character lands

Then repeat typing fast, and repeat immediately after the modal opens.

Also check whether focus visibly jumps — the cleanup calls `previous?.focus()`,
so focus should land on whatever was focused before the modal opened.

If characters are dropped or focus jumps: **confirmed**, continue below. If
typing is normal: close this as jsdom-only.

## Fix, if confirmed

The dependency, not the trap. Options:

**A — hold `onClose` in a ref** that the effect reads, so the effect's deps no
longer include an identity that changes every render. Local to `Modal`, fixes
every caller at once. Recommended.

**B — memoise `onClose` at every call site** with `useCallback`. Fixes the
symptom caller-by-caller and the next unmemoised handler reintroduces it. Worse.

**C — split the effect** so mount/unmount focus handling is keyed on `isOpen`
only, and anything genuinely needing `onClose` lives in its own effect. Cleanest
conceptually, largest change.

Prefer **A**. A component should not depend on its callers memoising their props.

## Verification, if confirmed

A DOM test using `userEvent.type` (not `fireEvent.change`) asserting a
multi-character string lands intact in a modal input — failing before, passing
after. Runbook 01's tests deliberately use `fireEvent.change` so they neither
depend on nor mask this; once fixed, one of them could be switched to
`userEvent` as a canary.

## Blast radius, if confirmed

Every modal in the app — all eight CRUD pages plus `CommandPalette`. That is what
makes it worth the reproduction effort despite the doubt.

## Not in scope

Runbook 01's fix is independent and already merged separately. Nothing here
blocks it.
