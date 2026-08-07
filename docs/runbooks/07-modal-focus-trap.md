# 07 — Modal focus trap stole focus between keystrokes

**Severity:** **High** · **Status:** ✅ **Fixed** — confirmed in real Chromium, then fixed and verified · **Found:** while writing tests for runbook 01, not by the original review.

## Read this first

An earlier revision of this runbook was marked **UNVERIFIED / jsdom only** and
made a browser reproduction its first step, on the theory that jsdom's
synchronous focus model might be manufacturing the failure.

**That reproduction has now been done, and the bug is real.** Everything below
about doubt is kept only as a record of how the question was settled; none of it
is still open. The severity is **High**, not "unknown".

## What it did

**You could type exactly one character into any modal field in this app.** Every
modal, every field, every page. The first keystroke landed, focus left the input,
and every subsequent keystroke went nowhere.

## Confirmed in a real browser

Reproduced with Playwright against real Chromium, using a harness rendering the
real `Modal` + `Input` with an inline-arrow `onClose` — the same shape every page
uses.

```
BEFORE FIX
after .type("Alexandra", delay 40): "A"   | active: DIV[dialog]
after .type("Bartholomew", delay 0):  "B"   | active: DIV[dialog]

AFTER FIX
after .type("Alexandra", delay 40): "Alexandra"    | active: firstName
after .type("Bartholomew", delay 0):  "Bartholomew"  | active: firstName
```

Note the `active:` column — before the fix, focus sits on the dialog container,
not the input. Typing speed made no difference: `delay 40` (normal human speed)
and `delay 0` (as fast as the driver can go) both dropped everything after the
first character.

**`.fill()` works either way**, which is why this hid for so long. `fill()` sets
the value in one shot and never exercises per-keystroke focus. Only discrete
keystrokes reveal it — in Playwright, and equally in jsdom, where
`userEvent.type` catches it and `fireEvent.change` does not.

## The mechanism

`ModalPanel` in `src/components/ui.tsx` keyed its focus-trap `useEffect` on
`[onClose]`. The chain:

1. Every call site passes `onClose` as an **inline arrow**, so its identity is
   new on every parent render.
2. A controlled input inside the modal re-renders its parent on every keystroke.
3. New `onClose` identity → the effect tears down and re-runs.
4. Its cleanup calls `previous?.focus()` — focus leaves the input for whatever
   was focused before the modal opened.
5. Every later keystroke goes nowhere.

## Why it hit every modal

There is not a single `useCallback` anywhere under `src/pages/`:

```
$ grep -rn "useCallback" src/pages/ | wc -l
0
```

So no call site accidentally escaped it. All eight CRUD pages plus
`CommandPalette` were affected uniformly.

## Why "surely someone would have noticed" was worthless here

The original write-up argued this was probably jsdom-only because production has
~1,575 rows that "must have been typed in." That argument was already dead before
the browser test, and it is worth recording why.

Every one of those rows was bulk imported:

```sql
SELECT source_system, count(*) FROM burials  GROUP BY 1;  -- dim_party_dmp_west | 796
SELECT source_system, count(*) FROM customers GROUP BY 1;  -- dim_party_dmp_west | 779
```

100% of both tables came through `scripts/import/load.py`, not the UI. Every
other table — contracts, AR, AP, work orders, inventory, payment schedule — is at
zero rows. The app had **no hand-entry usage history at all**, so the absence of
complaints was evidence of nothing. Check row provenance before leaning on that
argument again.

## How it was found

Not by review, and not by looking at `ui.tsx`. Writing a DOM test for runbook 01,
`userEvent.type` registered only the first character. An isolated `useForm` +
`Input` harness typed correctly, which localised the fault to the modal wrapper.

Worth keeping as method: the bug was found by a test failing *for the wrong
reason*. A test that fails unexpectedly is evidence about the system, not just an
obstacle to route around — switching to `fireEvent` and moving on would have
buried it. (Runbook 01's tests do use `fireEvent.change`, and that was the right
call for them; they document why, and point here.)

## The fix

Applied in `src/components/ui.tsx`, `ModalPanel`:

1. Hold the latest `onClose` in a ref, re-pointed on every render.
2. Escape calls `onCloseRef.current()` rather than `onClose()`.
3. The focus-trap effect's deps drop from `[onClose]` to `[]`.

Empty deps are correct, not a suppression: `Modal` renders `ModalPanel` only
while open (the `isOpen && <ModalPanel/>` guard), so **mount is open and unmount
is close** — the effect's lifecycle already matches the modal's exactly. ESLint's
`exhaustive-deps` agrees; the effect no longer closes over `onClose`, so no
disable directive is needed (and one would fail `--report-unused-disable-directives`).

Re-pointing the ref on every render is load-bearing: it keeps Escape running the
*current* handler, so nothing observes a closure over stale state.

### Rejected alternatives

**Memoise `onClose` with `useCallback` at every call site.** A component must not
depend on its callers memoising their props. It fixes the symptom site by site,
and the next unmemoised handler someone writes silently reintroduces the bug with
no test to catch it.

**Remove `previous?.focus()` from the cleanup.** That call restores focus to the
opener when the modal closes, which is correct and desirable accessibility
behaviour. It was never the fault — running it mid-edit was.

## Verification

`src/components/Modal.test.tsx`. Two tests target the defect using
`userEvent.type` (never `fireEvent.change`, which passes either way), and both
were observed **failing against unfixed `main`** with the same signature as the
browser:

```
 ❯ src/components/Modal.test.tsx  (7 tests | 2 failed)
   → expect(element).toHaveValue(Alexandra)   Received: A
   → expect(element).toHaveValue(Bartholomew) Received: B
```

After the fix: `7 passed`.

The other five tests pin the rest of that single effect, all of which the fix had
to preserve — Escape still closes (including after a re-render), Tab still cycles
within the dialog in both directions, body scroll stays locked while open and is
restored on close, and focus still returns to the opener. A seventh guards the
fix's own hazard: that the ref cannot go stale and invoke a handler closed over
outdated state.

Full suite after the fix: 17 files, 200 tests, all passing; lint, typecheck, and
build clean.

## Blast radius

Every modal in the app — all eight CRUD pages plus `CommandPalette`.

## Not in scope

The stale-validation-error issue (seven pages lack a `handleCloseModal`) is
runbook 05 and a separate PR. Runbook 01's fix is independent and already merged.
