import { describe, it, expect } from 'vitest';
import { buildCsv } from './DataTable';

describe('buildCsv', () => {
  it('joins header and rows with CRLF', () => {
    expect(buildCsv(['a', 'b'], [[1, 2], ['x', 'y']])).toBe('a,b\r\n1,2\r\nx,y');
  });

  it('quotes fields containing commas, quotes, and newlines', () => {
    expect(buildCsv(['name'], [['Smith, John']])).toBe('name\r\n"Smith, John"');
    expect(buildCsv(['q'], [['say "hi"']])).toBe('q\r\n"say ""hi"""');
    expect(buildCsv(['n'], [['line1\nline2']])).toBe('n\r\n"line1\nline2"');
  });

  it('renders null/undefined as empty fields', () => {
    expect(buildCsv(['a', 'b', 'c'], [[null, undefined, 0]])).toBe('a,b,c\r\n,,0');
  });
});
