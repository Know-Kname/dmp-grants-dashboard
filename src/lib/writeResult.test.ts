/**
 * The empty-result path — the case this whole module exists for.
 *
 * A PostgREST UPDATE or DELETE that RLS refuses returns `200` with `[]`, not an
 * error. Every one of these assertions is the difference between a user seeing
 * "you are not allowed to delete this" and seeing the row vanish and come back.
 */
import { describe, expect, it } from 'vitest';
import {
  WriteBlockedError,
  affectedRow,
  affectedRows,
  isWriteBlockedError,
} from './writeResult';

describe('affectedRows', () => {
  it('returns the rows when the write touched something', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(affectedRows(rows, 'delete')).toEqual(rows);
  });

  it('throws WriteBlockedError when a delete affected no rows', () => {
    expect(() => affectedRows([], 'delete')).toThrow(WriteBlockedError);
  });

  it('throws WriteBlockedError when an update affected no rows', () => {
    expect(() => affectedRows([], 'update')).toThrow(WriteBlockedError);
  });

  it("names the administrator rule in the delete message, since that's the usual cause", () => {
    expect(() => affectedRows([], 'delete')).toThrow(/administrators/i);
  });

  it('says nothing was updated, rather than reporting a generic failure', () => {
    expect(() => affectedRows([], 'update')).toThrow(/nothing was updated/i);
  });

  it('treats a non-array (null, undefined, an object) as "no rows"', () => {
    // Belt and braces: `sb()` already rejects a null `data`, but a shape change
    // in the client must not turn a refusal back into a silent success.
    for (const value of [null, undefined, {}, 0, '']) {
      expect(() => affectedRows(value, 'delete')).toThrow(WriteBlockedError);
    }
  });
});

describe('affectedRow', () => {
  it('returns the single row of a by-id write', () => {
    expect(affectedRow([{ id: 'a', name: 'x' }], 'update')).toEqual({ id: 'a', name: 'x' });
  });

  it('throws on an empty result', () => {
    expect(() => affectedRow([], 'update')).toThrow(WriteBlockedError);
  });
});

describe('WriteBlockedError', () => {
  it('is distinguishable from an ordinary Error', () => {
    const blocked = new WriteBlockedError('nope');
    expect(isWriteBlockedError(blocked)).toBe(true);
    expect(isWriteBlockedError(new Error('nope'))).toBe(false);
    expect(isWriteBlockedError('nope')).toBe(false);
  });

  it('carries its message through, so getErrorMessage() can surface it', () => {
    expect(new WriteBlockedError('nope').message).toBe('nope');
    expect(new WriteBlockedError('nope').name).toBe('WriteBlockedError');
  });
});
