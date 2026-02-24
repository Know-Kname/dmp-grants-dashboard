/**
 * Pagination Component
 * Provides navigation controls for paginated data
 */

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "./ui";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
}

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  pagination,
  onPageChange,
  onLimitChange,
  showPageSize = true,
  pageSizeOptions = [10, 20, 50, 100],
  className = "",
}: PaginationProps) {
  const { page, limit, total, totalPages, hasMore } = pagination;
  const hasPrev = pagination.hasPrev ?? page > 1;
  const hasNext = pagination.hasNext ?? hasMore;

  // Calculate displayed range
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // Generate page numbers to display
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (total === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
    >
      {/* Results info */}
      <div className="text-sm text-foreground-muted">
        Showing <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> results
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {showPageSize && onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-muted">Per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
              className="h-8 px-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation buttons */}
        <nav className="flex items-center gap-1" aria-label="Pagination">
          {/* First page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!hasPrev}
            className="hidden sm:flex"
            aria-label="First page"
          >
            <ChevronsLeft size={16} />
          </Button>

          {/* Previous page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </Button>

          {/* Page numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {getPageNumbers().map((pageNum, index) =>
              pageNum === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-foreground-muted"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="min-w-[32px]"
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === page ? "page" : undefined}
                >
                  {pageNum}
                </Button>
              ),
            )}
          </div>

          {/* Mobile page indicator */}
          <span className="sm:hidden text-sm text-foreground-muted px-2">
            {page} / {totalPages}
          </span>

          {/* Next page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </Button>

          {/* Last page */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNext}
            className="hidden sm:flex"
            aria-label="Last page"
          >
            <ChevronsRight size={16} />
          </Button>
        </nav>
      </div>
    </div>
  );
}

// ============================================
// PAGINATION HOOK
// ============================================

import { useCallback, useMemo, useState } from "react";

interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
}

interface UsePaginationReturn {
  page: number;
  limit: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  reset: () => void;
  queryParams: { page: string; limit: string };
}

export function usePagination({
  initialPage = 1,
  initialLimit = 20,
}: UsePaginationOptions = {}): UsePaginationReturn {
  const [page, setPageState] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage));
  }, []);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    setPageState(1); // Reset to first page when limit changes
  }, []);

  const reset = useCallback(() => {
    setPageState(initialPage);
    setLimitState(initialLimit);
  }, [initialPage, initialLimit]);

  const queryParams = useMemo(
    () => ({
      page: String(page),
      limit: String(limit),
    }),
    [page, limit],
  );

  return {
    page,
    limit,
    setPage,
    setLimit,
    reset,
    queryParams,
  };
}
