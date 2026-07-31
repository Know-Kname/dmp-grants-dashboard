/**
 * React Query Configuration and Provider
 * TanStack Query setup with error handling and defaults
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { isApiError } from './api';

// Default stale time: 5 minutes
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

// Default cache time: 30 minutes
const DEFAULT_GC_TIME = 30 * 60 * 1000;

/**
 * Create a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // How long data is considered fresh
        staleTime: DEFAULT_STALE_TIME,
        // How long inactive data stays in cache
        gcTime: DEFAULT_GC_TIME,
        // Retry failed requests
        retry: (failureCount, error) => {
          // Don't retry on auth errors
          if (isApiError(error) && error.isAuthError()) {
            return false;
          }
          // Don't retry on validation errors
          if (isApiError(error) && error.isValidationError()) {
            return false;
          }
          // Don't retry on not found
          if (isApiError(error) && error.isNotFound()) {
            return false;
          }
          // Everything else — including connection failures, which Supabase
          // surfaces as a plain Error — retries twice.
          return failureCount < 2;
        },
        // Exponential backoff for retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus (can be overridden per query)
        refetchOnWindowFocus: true,
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        // Don't retry mutations by default
        retry: false,
      },
    },
  });
}

// Singleton query client
let queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
}

/**
 * Query Provider Component
 */
interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

// ============================================
// QUERY KEYS
// ============================================

/**
 * Centralized query keys for consistent caching
 */
export const queryKeys = {
  /**
   * Server-side dashboard aggregates.
   *
   * `summary` and the two trends are separate keys on purpose: the dashboard's
   * 6M/12M/24M control changes only the trend range, and a single bundled key
   * would refetch every KPI on each toggle. The range is part of the trend keys
   * so each range is cached independently instead of thrashing one entry.
   */
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => [...queryKeys.dashboard.all, 'summary'] as const,
    burialTrend: (months: number) => [...queryKeys.dashboard.all, 'burial-trend', months] as const,
    revenueTrend: (months: number) => [...queryKeys.dashboard.all, 'revenue-trend', months] as const,
  },

  // Work Orders
  workOrders: {
    all: ['work-orders'] as const,
    list: () => [...queryKeys.workOrders.all, 'list'] as const,
    /** Newest N only — the dashboard activity feed, which must stay bounded. */
    recent: (limit: number) => [...queryKeys.workOrders.all, 'recent', limit] as const,
    detail: (id: string) => [...queryKeys.workOrders.all, 'detail', id] as const,
  },

  // Grants
  grants: {
    all: ['grants'] as const,
    list: () => [...queryKeys.grants.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.grants.all, 'detail', id] as const,
  },

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    list: () => [...queryKeys.inventory.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.inventory.all, 'detail', id] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    list: () => [...queryKeys.customers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.customers.all, 'detail', id] as const,
  },

  // Burials
  burials: {
    all: ['burials'] as const,
    list: () => [...queryKeys.burials.all, 'list'] as const,
    /** Newest N only — the dashboard activity feed, which must stay bounded. */
    recent: (limit: number) => [...queryKeys.burials.all, 'recent', limit] as const,
    detail: (id: string) => [...queryKeys.burials.all, 'detail', id] as const,
    /**
     * Public memorial page (`/memorial/:id`), which reads a narrowed column set
     * for published burials only.
     *
     * Derived from `.all` so a burial mutation invalidates it along with
     * everything else. It previously used a hand-written `['burials','memorial',id]`
     * literal that happened to share the same prefix — correct only by
     * coincidence, and silently broken if `.all` were ever renamed.
     */
    memorial: (id: string) => [...queryKeys.burials.all, 'memorial', id] as const,
  },

  // Contracts
  contracts: {
    all: ['contracts'] as const,
    list: () => [...queryKeys.contracts.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.contracts.all, 'detail', id] as const,
  },

  // Financial
  financial: {
    deposits: {
      all: ['financial', 'deposits'] as const,
      list: () => [...queryKeys.financial.deposits.all, 'list'] as const,
    },
    receivables: {
      all: ['financial', 'receivables'] as const,
      list: () => [...queryKeys.financial.receivables.all, 'list'] as const,
    },
    payables: {
      all: ['financial', 'payables'] as const,
      list: () => [...queryKeys.financial.payables.all, 'list'] as const,
    },
  },

  // Vendors
  vendors: {
    all: ['vendors'] as const,
    list: () => [...queryKeys.vendors.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.vendors.all, 'detail', id] as const,
  },

  // Payment Schedule
  paymentSchedule: {
    all: ['payment-schedule'] as const,
    byContract: (contractId: string) => [...queryKeys.paymentSchedule.all, 'contract', contractId] as const,
  },

  /**
   * User accounts (`public.profiles`) — the `/users` admin page.
   *
   * RLS narrows a SELECT here to the caller's own row unless they are an admin,
   * so the same key holds "everyone" for an admin and "just me" for anybody
   * else. That is fine because the cache is cleared on sign-out (see
   * `signOutEverywhere` in `lib/auth`), which is what stops one user's list
   * being served to the next.
   */
  profiles: {
    all: ['profiles'] as const,
    list: () => [...queryKeys.profiles.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.profiles.all, 'detail', id] as const,
  },

  // Cemetery Hierarchy
  cemeteries: {
    all: ['cemeteries'] as const,
    list: () => [...queryKeys.cemeteries.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.cemeteries.all, 'detail', id] as const,
  },
  sections: {
    all: ['sections'] as const,
    byCemetery: (cemeteryId: string) => [...queryKeys.sections.all, 'cemetery', cemeteryId] as const,
  },
  lots: {
    all: ['lots'] as const,
    bySection: (sectionId: string) => [...queryKeys.lots.all, 'section', sectionId] as const,
  },
  graves: {
    all: ['graves'] as const,
    byLot: (lotId: string) => [...queryKeys.graves.all, 'lot', lotId] as const,
  },
};
