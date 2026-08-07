# 01 — A contract priced with line items cannot be created

**Severity:** High · **Status:** Live on `main` @ `83dd6b7` · **Exposure:** `contracts` = 0 rows, so this blocks on first real use rather than corrupting existing data.

## Summary

On the New Contract form, pricing a contract with line items instead of a typed
total makes the **Create Contract button a silent no-op**. Nothing happens, no
error appears, and the user has no indication why.

## Reproduction

1. Contracts → **New Contract**
2. Fill Contract Number, Customer, Signed Date
3. **Do not type anything into Total Amount**
4. Click **Add Item**, enter a description and an amount
5. Click **Create Contract**

Nothing happens. The modal stays open, no error renders, no network request
fires. Repeats forever.

**Escape hatch (why this wasn't caught):** typing a total *before* adding line
items works — submit passes and `computedTotal` correctly overrides the typed
value. Anyone testing in that order sees a working form.

## Root cause

`src/lib/schemas.ts:253-256`:

```ts
totalAmount: z.union([
  z.string().transform((val) => parseFloat(val)),
  z.number(),
]).pipe(positiveNumberSchema),
```

`.pipe()` applies to the **union as a whole**, not per member. Empty string →
`parseFloat('')` → `NaN` → `positiveNumberSchema` (`z.number().min(0)`) rejects
with `Expected number, received nan`.

Two things then combine to make it silent:

1. **The gate runs before the compensation.** `useForm.handleSubmit` does
   `schema.safeParse(values)` and returns early on failure. The `computedTotal`
   substitution lives *inside* `onSubmit` (`src/pages/Contracts.tsx:157` region),
   downstream of the gate — it can never run.
2. **The error has nowhere to render.** `src/pages/Contracts.tsx:473` renders the
   Total Amount input only when `lineItems.length === 0`. Once a line item
   exists the field is unmounted, taking its `error` prop with it. The error sits
   in `form.errors.totalAmount` unrendered; `PageError` only surfaces
   query/mutation errors, not field errors.

Nothing writes `computedTotal` into form values — the only writers of
`values.totalAmount` are `initialForm` (`''`), `handleEdit`
(`String(c.totalAmount)`), and the input itself.

**Verified:** probe against the real schema returned
`{"success": false, "code": "invalid_type", "expected": "number", "received": "nan"}`
for `''`, and driving the real `useForm` gave `onSubmit` call count **0**.

## Why it shipped

Introduced by `6032349` *"feat: validate Vendors and Contracts forms"*. The
pre-diff code was `lineItems.length > 0 ? computedTotal : parseFloat(...) || 0`
with **no validation gate** — the `|| 0` absorbed the NaN.

The conversion made every schema field unconditionally required without checking
which fields the UI treats as conditional. **No test exercises the submit gate**
— `useForm.test.ts` tests the hook generically and schema tests parse shapes in
isolation, so nothing asserts "this form, with this realistic input, actually
submits."

Edit is unaffected because `handleEdit` seeds a numeric string.

## Fix options

**A — make the schema model the real contract (recommended).** Total is optional
when line items supply it. Express that in the schema rather than in the UI:

```ts
totalAmount: z.union([z.literal(''), z.string(), z.number()])
  .transform((v) => (v === '' ? undefined : Number(v)))
  .pipe(positiveNumberSchema.optional()),
```

then `.superRefine()` on the object to require a total *or* at least one line
item. Keeps one source of truth and fixes the silent-failure class, not just
this instance.

**B — sync `computedTotal` into form values.** An effect writing `computedTotal`
to `totalAmount` whenever line items change. Smaller, but adds a second writer
to that field and leaves the schema lying about what is required.

**C — always render the input, disabled and auto-filled, when line items exist.**
Cheapest and makes the value visible — but leaves the schema/UI mismatch intact,
so the next conditional field reintroduces the bug.

Prefer A. B and C treat the symptom.

## Verification

Regression test that **must fail before the fix**:

```ts
it('accepts a contract priced entirely by line items', () => {
  const result = contractFormSchema.safeParse({
    contractNumber: 'C-1', type: 'preneed', customerId: crypto.randomUUID(),
    totalAmount: '', signedDate: '2026-01-01', status: 'draft',
  });
  expect(result.success).toBe(true);   // fails today: "received nan"
});
```

Plus a DOM-level test that the create path calls `onSubmit` when line items exist
and Total Amount is blank. Then run the reproduction by hand and confirm a
contract is created with `total_amount` equal to the line-item sum.

## Prevention

Every form gets one **submit-gate test**: realistic values in, assert the
mutation is called. Schema-parse tests alone did not catch this and structurally
cannot — they never exercise the field's conditional rendering.

## Blast radius

Check every other conditionally-rendered or conditionally-required field for the
same schema/UI disagreement. `WorkOrders` declares
`status: workOrderStatusSchema.optional()` with no bound control (see runbook
04) — the mirror image of this bug.

## Not in scope

The line-item deletion defect in the same file is runbook 02 — different cause,
different origin, fix separately.
