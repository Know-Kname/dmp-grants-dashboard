# 05 — Stale validation errors bleed into the next modal

**Severity:** Low (cosmetic, not data-corrupting) · **Status:** ✅ **Fixed** — see *Resolution* below · **Exposure when open:** the only finding users could hit — Customers (779 rows) and Burials (796 rows) are in active use.

## Summary

Fail a create, cancel, then edit an existing record: the Edit modal opens with
correct data populated and **red "X is required" errors underneath it**.

## Reproduction

Verified end to end against a real `Customers` render:

1. Customers → **New Customer**
2. Leave First Name and Last Name blank → **Save**
   (errors appear, and every field is marked touched)
3. Click **Cancel**
4. Click **Edit** on any existing customer

The modal opens with `Ada` / `Lovelace` populated and *"First name is required"*
/ *"Last name is required"* rendered in red beneath the filled fields.

The error clears as soon as you blur the field, and saving works normally.

## Root cause

`src/hooks/useForm.ts:185-187`:

```ts
const setValues = useCallback((newValues: Partial<TValues>) => {
  setValuesState((prev) => ({ ...prev, ...newValues }));
}, []);
```

It merges values and touches **neither `errors` nor `touched`**. `handleSubmit`
marks every key touched and writes errors; `reset` is the only thing that clears
both.

`Modal` returns `null` when closed, unmounting its children — but `useForm` is
instantiated in the **page** component, which stays mounted. So closing the modal
resets nothing.

## Affected pages — the review got this backwards

The review named **Contracts**. Contracts is the one page **immune**:
`handleCloseModal` calls `form.reset(initialForm)` and is wired to both the
Cancel button and the backdrop/Esc handler.

| Page | Cancel | backdrop/Esc | Affected |
|---|---|---|---|
| Customers | no reset | no reset | yes (verified) |
| Grants | no reset | resets | yes, via Cancel only |
| Burials | no reset | no reset | yes |
| Inventory | no reset | no reset | yes |
| Vendors | no reset | no reset | yes |
| WorkOrders | no reset | no reset | yes |
| Financial | no reset | no reset | yes — **worse**, see below |
| **Contracts** | resets | resets | **no** |

**Financial is a different shape.** `handleOpenCreate` resets nothing either, so
a failed create → Cancel → New reopens with **stale values as well as stale
errors** — the user sees data they thought they discarded.

## Severity — deliberately downgraded

The review implied this breaks Edit. It does not. `handleSubmit` re-parses from
scratch and overwrites `errors` wholesale, so a valid Edit **still saves**. Blur
revalidates and clears the false error.

It is a trust problem, not a correctness one — and on the two highest-traffic
pages in the app, which is why it is worth fixing despite the low severity.

## Fix options

**A — reset on modal close, per page (recommended).** Give every page a
`handleCloseModal` that calls `form.reset(initialForm)`, wired to both the Cancel
button and the Modal's `onClose`. This is exactly what Contracts already does —
**copy the pattern that already works in this codebase** rather than inventing
one. Explicit, and preserves the ability to keep state open deliberately.

**B — clear `errors`/`touched` inside `setValues`.** One-line hook change fixing
all seven pages at once. Tempting, but `setValues` is a general-purpose setter —
silently discarding validation state on every partial update is surprising, and
would break any future caller that patches one field mid-validation.

**C — add a `resetOnClose` option to `useForm`.** Over-engineered for seven call
sites that can each spare one line.

Prefer **A**. If the repetition grates, extract a small `useModalForm` wrapper —
but only after A proves the pattern.

## Verification

Regression test that **must fail first**: render a page, fail a create, cancel,
open Edit, and assert **no** error text is present while the inputs are
populated. The provided probe did exactly this and observed
`errors rendered in Edit modal = [ 'First name is required', 'Last name is required' ]`.

Fix Financial's stale *values* case separately in the same pass.

## Prevention

Any hook holding validation state alongside values needs an explicit answer to
"what clears this, and when?" Document it in the hook's header. `reset` exists;
nothing said it was mandatory on close.

## Blast radius

The seven pages above. Empty-state "New X" buttons also skip the reset, but they
are unreachable once records exist — fix them anyway while you are in the file.

## Not in scope

The two dormant `useForm` defects — runbook 06. Different mechanisms, no user
impact today.

---

## Resolution

Fixed by **option A, applied at the entry points rather than the exits.**

### What was actually implemented, and why it differs from the recommendation

The recommendation above says "reset on modal close." That is necessary but it is
not the guarantee, and surveying the pages showed why: each one had **three**
ways into the modal and they had already drifted apart.

| Entry point | Before | Cleared errors? |
|---|---|---|
| Header "New X" button | `form.reset(initialForm)` | yes |
| Empty-state "New X" button | `setShowModal(true)` and nothing else | **no** |
| `handleEdit` | `form.setValues({...})` | **no** |

Exit-normalisation only holds while every exit stays wired; entry-normalisation
is self-sufficient. If the form is in a known state whenever the modal opens,
stale state is unreachable no matter how it was last closed — including from
paths nobody has written yet.

So every page now routes all three entry points through `handleOpenCreate` or
`handleEdit`, and both exits through `handleCloseModal`.

The core change needed **no new machinery** — it deletes a wrong call:

```ts
// before — leaves errors and touched from a prior failed create
form.setValues({ firstName: c.firstName, ... });

// after — one existing API, seeds values and clears errors + touched
form.reset({ ...initialForm, firstName: c.firstName, ... });
```

`reset(newValues?)` already did the whole job (`useForm.ts`). Seven pages were
reaching for the weaker sibling. The `...initialForm` spread is load-bearing:
`reset` **replaces** wholesale where `setValues` merged, so any field a page
omits would otherwise land as `undefined`.

### Correction: Contracts was not immune

This runbook says Contracts is "the one page immune." That is true of the
*reported* reproduction — its `handleCloseModal` is wired to both exits — but its
**empty-state button had the same un-normalised entry point** as everyone else's.
It survived only because its exit happened to be clean. Contracts now has a
`handleOpenCreate` too, and its `handleEdit` uses `reset` like the rest.

This is the same shape of error as the original review's: judging a page by the
one path that was tested rather than by every path that exists.

### Coverage

`src/pages/Customers.test.tsx` and `src/pages/Financial.test.tsx`, both observed
**failing against unfixed `main`** first:

- Customers — Edit after a cancelled failed create still showed
  *"First name is required"* over `Ada` / `Lovelace`.
- Customers — the empty-state entry point reopened with errors intact.
- Financial — an abandoned deposit came back with `500` still in the Amount
  field. This was the stale-**values** variant, and the one a user would read as
  the app having kept data they discarded.

`src/hooks/useForm.test.ts` additionally pins the *difference* between `setValues`
and `reset`, so the distinction stays a decision rather than something a later
"simplification" quietly erases — which is precisely what option B would have
done.

### Prevention, implemented

`useForm`'s header now answers the question this runbook asked it to: what clears
validation state, when, and what that means for a form whose owner outlives its
inputs.
