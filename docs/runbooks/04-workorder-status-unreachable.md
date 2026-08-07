# 04 — A work order can never leave "pending"

**Severity:** High (functional gap; low data risk) · **Status:** Live on `main` @ `83dd6b7` · **Exposure:** `work_orders` = 0 rows.

## Summary

Work orders are created as `pending` and there is **no control anywhere in the
UI to change that**. Deletion is the only way one leaves the list. The module
is non-functional as a workflow tool.

## Reproduction

1. Work Orders → create one → it appears as **pending**
2. Edit it, change anything, save
3. Status is still **pending**. It always will be.

Consequences visible immediately: the "Open / In Progress" stat tile equals the
total count, the status filter's other three options always render the empty
state, and every badge is amber.

## Root cause

Two halves, both required.

**Create hardcodes it** — `src/hooks/useData.ts:194` and the create mutation:

```ts
const NEW_WORK_ORDER_STATUS = 'pending' satisfies WorkOrder['status'];
...
mutationFn: async (data: Omit<CreateInput<WorkOrder>, 'createdBy' | 'status'>) => {
  ... status: NEW_WORK_ORDER_STATUS,
```

`status` is *structurally excluded* from the create input type.

**Edit drops it** — `src/pages/WorkOrders.tsx:137-144` enumerates the payload by
hand:

```ts
const payload = {
  title: data.title,
  description: data.description,
  type: data.type,
  priority: data.priority,
  assignedTo: data.assignedTo || undefined,
  dueDate: data.dueDate || undefined,
};
```

No `status`, no `completedDate`. `handleEdit` does not seed `status` into form
state and `initialForm` has no `status` key.

**The schema declares it and nothing binds it** — `src/lib/schemas.ts:69` has
`status: workOrderStatusSchema.optional()`, but the modal renders six controls
and none is a status `Select`. `useUpdateWorkOrder` has exactly one call site
repo-wide, so there is no alternate path.

**No server-side escape hatch** — verified live: `work_orders_status_check`
allows `pending | in_progress | completed | cancelled`; the only trigger is
`set_updated_at`; no default on `status`.

The three UI elements the review cited are all real: badge column, status filter
(`STATUS_FILTER_OPTIONS`), and the "Open / In Progress" `StatCard`.

## Why it shipped

Same root as runbook 03: the create path was fixed by hardcoding a value for a
`NOT NULL` column, without modelling what advances it.

Compounding it, the hand-enumerated payload is a **silent** dropper — adding a
field to the schema and the form does nothing unless someone also remembers to
add it to this object literal. Nothing warns. Contrast with spreading a validated
payload, where the type system participates.

Note the mirror-image relationship with runbook 01: there, the schema required a
field the UI treated as optional; here, the schema declares a field the UI never
exposes. Both are schema/UI disagreements that no test could catch, because no
test drives a form's submit path end to end.

## Fix options

**A — add a status Select to the edit modal (recommended).** Bind
`workOrderStatusSchema` to a control, include `status` in the payload, and seed
it in `handleEdit`. Delivers the actual missing capability. Also handle
`completedDate` — setting status to `completed` without a completion date leaves
a second column permanently null.

**B — quick-action buttons on each row** ("Start", "Complete") firing targeted
mutations. Better UX for the common transitions, but it is additive to A, not a
substitute — it still needs the payload to carry `status`.

**C — spread the validated payload instead of enumerating it.** Structural fix
for the dropper class: `updateMutation.mutate({ id, ...data })` once `data` is
schema-validated. Do this *alongside* A; it prevents the next field from being
silently lost.

Recommended: **A + C**.

## Verification

Regression test that **must fail first**: assert the update payload contains
`status` after changing it in the form.

Then end to end: create a work order, move it to `in_progress`, confirm the badge
and the stat tile both change and the filter finds it under In Progress. Then
`completed`, and confirm `completed_date` is populated.

## Prevention

Prefer spreading a validated payload over hand-enumerated object literals. Where
enumeration is genuinely needed, add a test asserting the payload keys match the
schema's keys, so a field added to one and not the other fails loudly.

## Blast radius

Audit every page's submit payload for fields present in the schema but absent
from the object literal. `Financial` (runbook 03) has the same shape.

## Not in scope

Any redesign of the work-order lifecycle. This is about making the existing four
documented states reachable.
