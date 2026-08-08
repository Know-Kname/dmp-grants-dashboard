/**
 * The payment-status rule for accounts receivable and payable.
 *
 * `status` is `NOT NULL` with no database default and no trigger that advances
 * it, so whatever writes a payment must also write the status. Before this
 * existed, nothing in the repository ever wrote `paid` or `partial`: a fully
 * settled invoice kept `status = 'pending'`, rendering Balance $0.00 beside a
 * Pending badge, and the `mark-overdue-ar` / `mark-overdue-ap` cron jobs (01:00
 * daily, both active) then flipped it to `overdue` — permanently, since no code
 * path could move it back. See `docs/runbooks/03-financial-invoice-status.md`.
 *
 * Lives here rather than inline at the call site so the rule has a name, a test,
 * and one place to change. The column's CHECK constraint permits
 * `pending | partial | paid | overdue`.
 */

/** The three states a payment can put an invoice into. */
export type PaymentStatus = 'pending' | 'partial' | 'paid';

/**
 * Derive an invoice's status from what has been paid against it.
 *
 * **Never returns `overdue`.** That state is a function of `due_date` and the
 * clock, not of the amounts, and the nightly cron owns it. The interaction is
 * deliberate and self-correcting: recording a partial payment on an overdue
 * invoice returns `partial`, and the next cron run re-flags it `overdue`
 * because its `WHERE status IN ('pending','partial')` still matches. Settling
 * it fully returns `paid`, which that same clause excludes — so a paid invoice
 * can never be dragged back to overdue.
 *
 * @param amountPaid Total recorded against the invoice, not the increment.
 * @param amount     The invoice total.
 * @returns `paid` once the total is met or exceeded (overpayments are refunds,
 *          handled elsewhere — there is no "overpaid" state), `partial` for any
 *          positive amount below it, `pending` for nothing.
 */
export function paymentStatus(amountPaid: number, amount: number): PaymentStatus {
  // Guard the degenerate case explicitly: with a zero or negative total,
  // `amountPaid >= amount` would call an untouched invoice "paid".
  if (amount > 0 && amountPaid >= amount) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'pending';
}
