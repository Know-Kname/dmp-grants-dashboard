/**
 * Custom React Query Hooks for Data Fetching
 * Provides type-safe data fetching with caching, loading states, and mutations.
 *
 * Pagination strategy:
 *   • All list hooks accept optional pagination/filter/search params
 *   • When params are provided → server-side pagination (returns PaginatedResponse)
 *   • When no params are provided → backward-compatible flat array (capped at 500)
 *   • useBurialsPaginated() always uses server-side pagination (39K+ rows)
 */

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, getErrorMessage, PaginatedResponse } from '../lib/api';
import { queryKeys } from '../lib/query';
import type {
  WorkOrder,
  Grant,
  InventoryItem,
  Customer,
  Burial,
  Contract,
  Deposit,
  AccountsReceivable,
  AccountsPayable,
} from '../types';

// ============================================
// GENERIC TYPES
// ============================================

interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: string;
  [key: string]: string | number | boolean | undefined;
}

// ============================================
// DASHBOARD STATS
// ============================================

interface DashboardStats {
  workOrders: { total: number; pending: number; inProgress: number; completed: number };
  inventory: { total: number; lowStock: number };
  receivables: { total: number; overdue: number; outstandingAmount: number };
  burials: { total: number; thisMonth: number };
  recentWorkOrders: Array<{ id: string; title: string; status: string; createdAt: string }>;
  recentBurials: Array<{ id: string; deceasedFirstName: string; deceasedLastName: string; burialDate: string }>;
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: () => api.get<DashboardStats>('/stats'),
    staleTime: 30_000, // 30 seconds — dashboard data can be slightly stale
  });
}

// ============================================
// WORK ORDERS
// ============================================

export function useWorkOrders(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.workOrders.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<WorkOrder>>('/work-orders', { params })
        : api.get<WorkOrder[]>('/work-orders') as Promise<PaginatedResponse<WorkOrder>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.workOrders.detail(id),
    queryFn: () => api.get<WorkOrder>(`/work-orders/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkOrder(callbacks?: MutationCallbacks<WorkOrder>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) =>
      api.post<WorkOrder>('/work-orders', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateWorkOrder(callbacks?: MutationCallbacks<WorkOrder>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<WorkOrder> & { id: string }) =>
      api.put<WorkOrder>(`/work-orders/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDeleteWorkOrder(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/work-orders/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// GRANTS
// ============================================

export function useGrants(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.grants.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<Grant>>('/grants', { params })
        : api.get<Grant[]>('/grants') as Promise<PaginatedResponse<Grant>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useGrant(id: string) {
  return useQuery({
    queryKey: queryKeys.grants.detail(id),
    queryFn: () => api.get<Grant>(`/grants/${id}`),
    enabled: !!id,
  });
}

export function useCreateGrant(callbacks?: MutationCallbacks<Grant>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Grant, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Grant>('/grants', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateGrant(callbacks?: MutationCallbacks<Grant>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Grant> & { id: string }) =>
      api.put<Grant>(`/grants/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDeleteGrant(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/grants/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// INVENTORY
// ============================================

export function useInventory(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.inventory.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<InventoryItem>>('/inventory', { params })
        : api.get<InventoryItem[]>('/inventory') as Promise<PaginatedResponse<InventoryItem>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.detail(id),
    queryFn: () => api.get<InventoryItem>(`/inventory/${id}`),
    enabled: !!id,
  });
}

export function useCreateInventoryItem(callbacks?: MutationCallbacks<InventoryItem>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<InventoryItem>('/inventory', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateInventoryItem(callbacks?: MutationCallbacks<InventoryItem>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<InventoryItem> & { id: string }) =>
      api.put<InventoryItem>(`/inventory/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDeleteInventoryItem(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/inventory/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// CUSTOMERS
// ============================================

export function useCustomers(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<Customer>>('/customers', { params })
        : api.get<Customer[]>('/customers') as Promise<PaginatedResponse<Customer>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: !!id,
  });
}

export function useCreateCustomer(callbacks?: MutationCallbacks<Customer>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Customer>('/customers', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateCustomer(callbacks?: MutationCallbacks<Customer>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Customer> & { id: string }) =>
      api.put<Customer>(`/customers/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDeleteCustomer(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/customers/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// BURIALS
// ============================================

/**
 * Backward-compatible hook — returns flat array (capped at 500 by backend).
 * Use useBurialsPaginated() for proper server-side pagination.
 */
export function useBurials(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.burials.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<Burial>>('/burials', { params })
        : api.get<Burial[]>('/burials') as Promise<PaginatedResponse<Burial>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

/**
 * Always-paginated hook for burials (39K+ rows).
 * Returns { data: Burial[], pagination: PaginationMeta }.
 */
export function useBurialsPaginated(params: PaginationParams = { page: 1, limit: 50 }) {
  return useQuery({
    queryKey: queryKeys.burials.list(params),
    queryFn: () => api.get<PaginatedResponse<Burial>>('/burials', { params }),
    placeholderData: keepPreviousData,
  });
}

export function useBurial(id: string) {
  return useQuery({
    queryKey: queryKeys.burials.detail(id),
    queryFn: () => api.get<Burial>(`/burials/${id}`),
    enabled: !!id,
  });
}

export function useCreateBurial(callbacks?: MutationCallbacks<Burial>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Burial, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Burial>('/burials', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.burials.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateBurial(callbacks?: MutationCallbacks<Burial>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Burial> & { id: string }) =>
      api.put<Burial>(`/burials/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.burials.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDeleteBurial(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/burials/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.burials.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// CONTRACTS
// ============================================

export function useContracts(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<Contract>>('/contracts', { params })
        : api.get<Contract[]>('/contracts') as Promise<PaginatedResponse<Contract>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContract(callbacks?: MutationCallbacks<Contract>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Contract>('/contracts', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateContract(callbacks?: MutationCallbacks<Contract>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Contract> & { id: string }) =>
      api.put<Contract>(`/contracts/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDeleteContract(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/contracts/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// FINANCIAL - DEPOSITS
// ============================================

export function useDeposits(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.financial.deposits.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<Deposit>>('/financial/deposits', { params })
        : api.get<Deposit[]>('/financial/deposits') as Promise<PaginatedResponse<Deposit>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useCreateDeposit(callbacks?: MutationCallbacks<Deposit>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Deposit, 'id' | 'createdAt' | 'createdBy'>) =>
      api.post<Deposit>('/financial/deposits', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.deposits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// FINANCIAL - ACCOUNTS RECEIVABLE
// ============================================

export function useReceivables(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.financial.receivables.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<AccountsReceivable>>('/financial/receivables', { params })
        : api.get<AccountsReceivable[]>('/financial/receivables') as Promise<PaginatedResponse<AccountsReceivable>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useCreateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<AccountsReceivable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'>) =>
      api.post<AccountsReceivable>('/financial/receivables', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.receivables.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; amountPaid?: number; status?: string }) =>
      api.put<AccountsReceivable>(`/financial/receivables/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.receivables.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// FINANCIAL - ACCOUNTS PAYABLE
// ============================================

export function usePayables(params?: PaginationParams) {
  const hasParams = params && (params.page || params.search);
  return useQuery({
    queryKey: queryKeys.financial.payables.list(params),
    queryFn: () =>
      hasParams
        ? api.get<PaginatedResponse<AccountsPayable>>('/financial/payables', { params })
        : api.get<AccountsPayable[]>('/financial/payables') as Promise<PaginatedResponse<AccountsPayable>>,
    placeholderData: hasParams ? keepPreviousData : undefined,
  });
}

export function useCreatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<AccountsPayable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'>) =>
      api.post<AccountsPayable>('/financial/payables', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.payables.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useUpdatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; amountPaid?: number; status?: string }) =>
      api.put<AccountsPayable>(`/financial/payables/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.payables.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      callbacks?.onError?.(error);
    },
  });
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Helper hook to get error message from any error
 */
export function useErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  return getErrorMessage(error);
}
