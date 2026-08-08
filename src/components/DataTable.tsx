/**
 * Generic sorted + paginated table for CRUD list pages.
 *
 * Deliberately scoped: render-prop cells, client-side sort, client-side
 * pagination (via the shared Pagination component), and CSV export. No row
 * selection, column resizing, or virtualization — row counts in this app
 * don't justify them.
 *
 * Rows stagger in on first mount only; sorting and page flips re-render
 * plainly so repeated interaction never feels syrupy.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { Button, Card, TABLE_HEAD_CLASS } from './ui';
import { Pagination } from './Pagination';
import { m, EASE_LUX } from '../lib/motion';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
  className?: string;
}

export interface CsvSpec<T> {
  filename: string;
  header: string[];
  row: (row: T) => (string | number | null | undefined)[];
}

/** Pure CSV builder (exported for tests). RFC-4180-style quoting. */
export function buildCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
}

function downloadCsv<T>(spec: CsvSpec<T>, rows: T[]) {
  const csv = buildCsv(spec.header, rows.map(spec.row));
  // BOM prefix so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = spec.filename.endsWith('.csv') ? spec.filename : `${spec.filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  csv,
  pageSize = 20,
  initialSort,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered inside the card when there are zero rows. */
  emptyState?: React.ReactNode;
  csv?: CsvSpec<T>;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const didAnimate = useRef(false);
  useEffect(() => {
    didAnimate.current = true;
  }, []);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      // Nulls sink to the bottom in either direction
      if (av === null || av === undefined || av === '') return 1;
      if (bv === null || bv === undefined || bv === '') return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((clampedPage - 1) * limit, clampedPage * limit),
    [sorted, clampedPage, limit]
  );

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  if (rows.length === 0 && emptyState) {
    return <Card>{emptyState}</Card>;
  }

  return (
    <Card>
      {/* Toolbar. The row count lives here rather than only in the pager so the
          answer to "how many are there" is visible before you scroll. */}
      {csv && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
          <p className="text-xs tabular-nums text-foreground-muted">
            {sorted.length.toLocaleString()} {sorted.length === 1 ? 'record' : 'records'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => downloadCsv(csv, sorted)}
          >
            Export CSV
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/*
            Deliberately NOT sticky, and it cannot be without a change nobody
            wants here.

            A `sticky` thead was tried and measured: it never stuck at all. The
            scroll wrapper above carries `overflow-x-auto`, and CSS computes the
            other axis to `auto` whenever one axis is not `visible` — so the
            wrapper becomes the nearest scroll container, `sticky` resolves
            against it, and since it has no height limit it never scrolls
            vertically and the header just moves with the page.

            The two ways to make it real are both worse than the problem:
            constrain the wrapper's height so the table gets its own vertical
            scrollport (a nested scroll region, in an app whose main complaint
            was that navigating it is hard), or drop horizontal scrolling so the
            axes can differ (which breaks wide tables on tablets). Pages hold 20
            rows and the toolbar names the record count, so the header scrolling
            away costs little.
          */}
          <thead className="border-b border-border bg-background-subtle">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const alignClass = col.align === 'right' ? 'text-right' : '';
                return (
                  <th key={col.key} className={`${TABLE_HEAD_CLASS} ${alignClass} ${col.className ?? ''}`}>
                    {col.sortValue ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className={`group/sort inline-flex min-h-0 items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground ${
                          isSorted ? 'text-foreground' : ''
                        }`}
                        aria-label={`Sort by ${col.key}`}
                      >
                        {col.header}
                        {/* The neutral glyph stays hidden until hover, so a
                            sorted column is the only arrow on screen and the
                            header row stops looking like a row of controls. */}
                        {isSorted ? (
                          sort!.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown
                            size={12}
                            className="opacity-0 transition-opacity group-hover/sort:opacity-50"
                          />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((row, i) => (
              <m.tr
                key={rowKey(row)}
                initial={didAnimate.current ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE_LUX, delay: Math.min(i * 0.025, 0.35) }}
                className={`group/row relative transition-colors hover:bg-card-hover ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`relative px-6 py-4 ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.className ?? ''}`}
                  >
                    {/* Accent edge on the first cell only — a marker for which
                        row the pointer is on, which plain background tint does
                        poorly once rows are this tall. Drawn on the cell rather
                        than the row because a <tr> cannot host a positioned
                        pseudo-element reliably across browsers. */}
                    {ci === 0 && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r bg-primary/70 transition-transform duration-200 ease-out group-hover/row:scale-y-100"
                      />
                    )}
                    {col.cell(row)}
                  </td>
                ))}
              </m.tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="px-4 py-3 border-t border-border">
          <Pagination
            pagination={{
              page: clampedPage,
              limit,
              total: sorted.length,
              totalPages,
              hasMore: clampedPage < totalPages,
            }}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </div>
      )}
    </Card>
  );
}
