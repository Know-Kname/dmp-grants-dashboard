# 06 — Two dormant `useForm` defects

**Severity:** Low · **Status:** Live in the hook on `main` @ `83dd6b7`, but **no consumer triggers either**. Fix opportunistically, or when wiring a feature that would wake them.

Both are real, both were reproduced, and neither affects a user today. They are
recorded so that the next person to touch these features does not rediscover them
the hard way.

---

## 6a — Blur wipes cross-field `.refine()` errors

### Mechanism

`fieldSchemaFor` unwraps `ZodEffects` to reach the inner object:

```ts
while (current instanceof z.ZodEffects) { current = current.innerType(); }
return current instanceof z.ZodObject ? (current.shape[field] ?? null) : null;
```

For a `.refine()`-wrapped schema this returns the field's **plain** schema —
`z.string()` for `confirmPassword` — which happily parses a mismatched value. The
blur handler then does `delete next[field]`, erasing a cross-field error that
`handleSubmit` had correctly set.

Reproduced:

```
after failed submit  errors= {"confirmPassword":"Passwords do not match"}  onSubmit calls= 0
after blur           errors= {}
after 2nd submit     errors= {"confirmPassword":"Passwords do not match"}  onSubmit calls= 0
```

So the form reports `isValid: true` while refusing to submit — the worst
combination.

The `if (!fieldSchema)` whole-form fallback is reachable only when the field is
absent from the shape, never for a real field of an object-rooted schema. Its
comment cites "a top-level `.refine()`" as the motivating case, which is exactly
the case it does **not** handle.

### Why it is dormant

No `useForm` consumer passes a root-`.refine()` schema. All ten call sites pass
plain `ZodObject`s. The only root-level `.refine()` in `schemas.ts` is
`registerFormSchema`, imported by nothing outside that file. The other two
`.refine()`s are **field-level**, so they live inside `shape[field]` and validate
correctly.

### The test that looks like coverage but is not

`useForm.test.ts` has *"reports a cross-field error against the field the schema
blames"* — it exercises `handleSubmit`, the whole-form path. It never calls
`validateField`. **No test covers blur on a `.refine()`-targeted field.**

This is worth internalising: a passing test named after the behaviour is not
evidence the behaviour is covered on every path.

### Fix

When the root schema is a `ZodEffects`, per-field validation must fall back to
validating the **whole form** and picking out this field's error, rather than
validating the field in isolation. Detect `ZodEffects` at the root *before*
unwrapping and take the fallback branch.

Add a test that fails first: set a cross-field error via submit, blur the field,
assert the error **survives**.

---

## 6b — `validateOnChange` validates the previous keystroke

### Mechanism

```ts
setValuesState((prev) => ({ ...prev, [field]: value }));
if (validateOnChange) { setTimeout(() => validateField(field), 0); }
```

`validateField` is `useCallback(..., [schema, values])` and reads `values[field]`.
The `setValue` closure captures the *current-render* `validateField`, which
closes over pre-update `values`. The `setTimeout` fires that stale reference.

Reproduced against the real DOM — errors lag input by exactly one keystroke and
**do not settle** after timers drain:

```
after typing "X"  value= X  error= Contract number is required
settled           value= X  error= Contract number is required
after clear       value= ""  error= NONE
```

### Why it is dormant

`grep -rn "validateOnChange" src/` returns nothing. No page enables it; the
default is `false`.

### Fix

Validate against the pending value rather than the closure — pass the new value
into `validateField`, or hold values in a ref that the timeout reads. Do not
"fix" it by adding `values` to a dependency array; that re-creates the callback
without addressing the stale capture at the moment of scheduling.

Add a test with `validateOnChange: true` asserting the error reflects the current
value after timers flush.

---

## Prevention (both)

`useForm` is shared by ten call sites and is under-tested at the **path** level.
Its tests cover `handleSubmit` well and `validateField` barely. Any change to one
validation path should be checked against the other — they can disagree, and 6a
is what that disagreement looks like.

## Not in scope

The `setValues` reset gap — runbook 05, which is live and user-visible.
