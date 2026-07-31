/**
 * Turning a silently-refused write into a loud one.
 *
 * PostgREST reports an RLS refusal differently depending on the verb, and the
 * difference is the whole reason this file exists:
 *
 *   INSERT — the policy is a WITH CHECK, so a refused insert *errors*
 *            (`new row violates row-level security policy`). The caller sees it.
 *   UPDATE — the policy is a USING clause, so it filters rows *before* the
 *   DELETE   update/delete runs. A refused write matches nothing, affects zero
 *            rows, and returns `200 OK` with an empty body. No error. Nothing.
 *
 * Measured on this project's schema: a `staff` user issuing a DELETE against
 * any of the 16 business tables gets exactly that — success, zero rows. React
 * Query then invalidates, the list refetches, and the row the user just watched
 * disappear comes straight back. The user reports "deleting doesn't work
 * sometimes"; nothing in the logs says otherwise.
 *
 * So every UPDATE and DELETE in `../hooks/useData` asks for the affected rows
 * back (`.select()`), and passes them through {@link affectedRows}. An empty
 * result is treated as what it almost always is: a refusal.
 *
 * The one ambiguity is honest and unavoidable — zero rows also means "that id
 * is already gone". The message covers both readings rather than pretending to
 * know which happened.
 */

/**
 * A write that the database accepted syntactically but applied to no rows.
 *
 * Its own class so callers can tell "you are not allowed to do that" apart from
 * "the request failed" — a distinction worth making in a toast, and one a bare
 * `Error` would lose.
 */
export class WriteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteBlockedError';
  }
}

export function isWriteBlockedError(error: unknown): error is WriteBlockedError {
  return error instanceof WriteBlockedError;
}

type WriteOp = 'update' | 'delete';

const BLOCKED_MESSAGE: Record<WriteOp, string> = {
  update:
    'Nothing was updated. Either the record no longer exists, or your role does not allow editing it. Read-only accounts cannot make changes.',
  delete:
    'Nothing was deleted. Either the record no longer exists, or your role does not allow deleting it — only administrators can delete records.',
};

/**
 * Assert that a returning write actually touched something.
 *
 * @param rows The `data` from a `.update(...).select()` / `.delete().select()`.
 *             Typed `unknown` because the Supabase client's row types and this
 *             app's domain types are different shapes (see `fromRow`).
 * @param op   Which verb ran, purely to pick the message.
 * @returns The affected rows, guaranteed non-empty.
 * @throws {WriteBlockedError} when the write affected no rows.
 */
export function affectedRows(rows: unknown, op: WriteOp): Record<string, unknown>[] {
  const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  if (list.length === 0) {
    throw new WriteBlockedError(BLOCKED_MESSAGE[op]);
  }
  return list;
}

/**
 * {@link affectedRows} for a write that targets exactly one row by primary key.
 *
 * @returns The single affected row.
 */
export function affectedRow(rows: unknown, op: WriteOp): Record<string, unknown> {
  return affectedRows(rows, op)[0];
}
