# 05 — Stale validation errors bleed into the next modal

**Severity:** Low (cosmetic, not data-corrupting) · **Status:** Live on `main` @ `83dd6b7` · **Exposure:** **the only finding users can hit today** — Customers (779 rows) and Burials (796 rows) are in active use.

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
