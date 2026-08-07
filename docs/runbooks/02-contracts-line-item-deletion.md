# 02 — Removing every line item from a contract is impossible

**Severity:** Medium · **Status:** Live on `main` @ `83dd6b7` · **Exposure:** `contracts` = 0 rows.

**This is not a regression.** `git show 6032349^` contains the identical
expression. It predates the validation work and was surfaced, not caused, by the
review.

## Summary

Deleting *some* line items works. Deleting *all* of them silently restores them.

## Reproduction

1. Edit a contract that has one or more line items
2. Click the **X** on every row until the list is empty
3. Save Changes
4. Reopen the contract — every item is back, with new database ids

## Root cause

`src/pages/Contracts.tsx:157`:

```ts
items: (itemsPayload.length > 0 ? itemsPayload : (editingContract?.items ?? [])) as ContractItem[],
```

The ternary cannot distinguish *"the user removed everything"* from *"no item
data supplied, fall back to what exists."* An emptied list takes the fallback
branch and resubmits the original items.

`useUpdateContract` (`src/hooks/useData.ts`, the `items !== undefined` branch)
then deletes all `contract_items` for the contract and re-inserts the payload.
Because the payload is the original set, the net effect is delete-then-restore
with fresh ids.

A secondary consequence: the contract can end up with a hand-typed
`total_amount` that disagrees with line items the user believed were gone.

## Why it shipped

The fallback is defensive code written for a payload that might legitimately omit
`items`. But `items` is now **always present** on the update payload, so the
guard only ever fires for the one case it should not: deliberate emptiness.

Classic "absent" vs "empty" conflation. `undefined` and `[]` mean different
things and the code treats them as one.

## Fix options

**A — pass the payload unconditionally when editing (recommended).**

```ts
items: (editingContract ? itemsPayload : itemsPayload) as ContractItem[],
```

i.e. drop the fallback entirely. `itemsPayload` already reflects exactly what the
user sees. If the concern is a create path that legitimately has no items, gate
on `editingContract` being set rather than on array length.

**B — make the distinction explicit.** Pass `items: itemsPayload ?? undefined`
and have the mutation skip the branch only on genuine `undefined`. More faithful
to the mutation's own `items !== undefined` check, slightly more plumbing.

Prefer A — the fallback protects against a case that no longer occurs.

## Verification

Regression test asserting the mutation receives `items: []` when the user has
removed every row, and an end-to-end pass: create a contract with 2 items, remove
both, save, reopen, confirm zero items and that `contract_items` has no rows for
that contract.

## Prevention

Wherever an array or object is optional in a payload, be explicit about whether
`[]` / `{}` is a meaningful value. A `length > 0` ternary that selects a fallback
is the shape to grep for.

## Blast radius

Only this call site. `useUpdateContract` is the sole consumer of the `items`
branch, and no other page constructs a nested-collection payload this way.

## Not in scope

The `totalAmount` submit gate (runbook 01). Both live in `Contracts.tsx` but have
independent causes; 01 is a regression, this is not.
