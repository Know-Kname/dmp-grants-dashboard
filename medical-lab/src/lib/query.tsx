import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { isApiError, isNetworkError } from './api';

const DEFAULT_STALE_TIME = 5 * 60 * 1000;
const DEFAULT_GC_TIME = 30 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.isAuthError()) return false;
          if (isApiError(error) && error.isValidationError()) return false;
          if (isApiError(error) && error.isNotFound()) return false;
          if (isApiError(error) && error.isConflict()) return false;
          if (isNetworkError(error)) return failureCount < 3;
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClient) queryClient = createQueryClient();
  return queryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

// ============================================
// QUERY KEYS — Lab domain
// ============================================

export const queryKeys = {
  patients: {
    all: ['patients'] as const,
    list: () => [...queryKeys.patients.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.patients.all, 'detail', id] as const,
  },
  providers: {
    all: ['providers'] as const,
    list: () => [...queryKeys.providers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.providers.all, 'detail', id] as const,
  },
  staff: {
    all: ['staff'] as const,
    list: () => [...queryKeys.staff.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.staff.all, 'detail', id] as const,
  },
  testCatalog: {
    all: ['test-catalog'] as const,
    list: () => [...queryKeys.testCatalog.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.testCatalog.all, 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: () => [...queryKeys.orders.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.orders.all, 'detail', id] as const,
  },
  specimens: {
    all: ['specimens'] as const,
    list: () => [...queryKeys.specimens.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.specimens.all, 'detail', id] as const,
  },
  results: {
    all: ['results'] as const,
    list: () => [...queryKeys.results.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.results.all, 'detail', id] as const,
  },
  instruments: {
    all: ['instruments'] as const,
    list: () => [...queryKeys.instruments.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.instruments.all, 'detail', id] as const,
  },
  reagents: {
    all: ['reagents'] as const,
    list: () => [...queryKeys.reagents.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.reagents.all, 'detail', id] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: () => [...queryKeys.invoices.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.invoices.all, 'detail', id] as const,
  },
  claims: {
    all: ['claims'] as const,
    list: () => [...queryKeys.claims.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.claims.all, 'detail', id] as const,
  },
  qcRuns: {
    all: ['qc-runs'] as const,
    list: () => [...queryKeys.qcRuns.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.qcRuns.all, 'detail', id] as const,
  },
};
