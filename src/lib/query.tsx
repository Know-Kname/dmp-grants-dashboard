/**
 * React Query Configuration and Provider
 * TanStack Query setup with error handling and defaults
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { isApiError, isNetworkError } from './api';

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
          // Retry network errors up to 3 times
          if (isNetworkError(error)) {
            return failureCount < 3;
          }
          // Default: retry twice
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
/**
 * Query parameter type for paginated list queries
 */
interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export const queryKeys = {
  // Dashboard Stats (lightweight aggregate endpoint)
  stats: {
    all: ['stats'] as const,
    dashboard: () => [...queryKeys.stats.all, 'dashboard'] as const,
  },

  // Work Orders
  workOrders: {
    all: ['work-orders'] as const,
    list: (params?: ListParams) => [...queryKeys.workOrders.all, 'list', params ?? {}] as const,
    detail: (id: string) => [...queryKeys.workOrders.all, 'detail', id] as const,
  },

  // Grants
  grants: {
    all: ['grants'] as const,
    list: (params?: ListParams) => [...queryKeys.grants.all, 'list', params ?? {}] as const,
    detail: (id: string) => [...queryKeys.grants.all, 'detail', id] as const,
  },

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    list: (params?: ListParams) => [...queryKeys.inventory.all, 'list', params ?? {}] as const,
    detail: (id: string) => [...queryKeys.inventory.all, 'detail', id] as const,
    lowStock: () => [...queryKeys.inventory.all, 'low-stock'] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    list: (params?: ListParams) => [...queryKeys.customers.all, 'list', params ?? {}] as const,
    detail: (id: string) => [...queryKeys.customers.all, 'detail', id] as const,
  },

  // Burials
  burials: {
    all: ['burials'] as const,
    list: (params?: ListParams) => [...queryKeys.burials.all, 'list', params ?? {}] as const,
    detail: (id: string) => [...queryKeys.burials.all, 'detail', id] as const,
  },

  // Contracts
  contracts: {
    all: ['contracts'] as const,
    list: (params?: ListParams) => [...queryKeys.contracts.all, 'list', params ?? {}] as const,
    detail: (id: string) => [...queryKeys.contracts.all, 'detail', id] as const,
  },

  // Financial
  financial: {
    deposits: {
      all: ['financial', 'deposits'] as const,
      list: (params?: ListParams) => [...queryKeys.financial.deposits.all, 'list', params ?? {}] as const,
    },
    receivables: {
      all: ['financial', 'receivables'] as const,
      list: (params?: ListParams) => [...queryKeys.financial.receivables.all, 'list', params ?? {}] as const,
    },
    payables: {
      all: ['financial', 'payables'] as const,
      list: (params?: ListParams) => [...queryKeys.financial.payables.all, 'list', params ?? {}] as const,
    },
  },

  // Users
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
  },
};
