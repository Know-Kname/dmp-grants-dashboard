/**
 * Custom React Query Hooks for Data Fetching
 * Provides type-safe data fetching with caching, loading states, and mutations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
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

// ============================================
// WORK ORDERS
// ============================================

export function useWorkOrders() {
  return useQuery({
    queryKey: queryKeys.workOrders.list(),
    queryFn: () => api.get<WorkOrder[]>('/work-orders'),
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

export function useGrants() {
  return useQuery({
    queryKey: queryKeys.grants.list(),
    queryFn: () => api.get<Grant[]>('/grants'),
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

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory.list(),
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
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

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.list(),
    queryFn: () => api.get<Customer[]>('/customers'),
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

export function useBurials() {
  return useQuery({
    queryKey: queryKeys.burials.list(),
    queryFn: () => api.get<Burial[]>('/burials'),
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

export function useContracts() {
  return useQuery({
    queryKey: queryKeys.contracts.list(),
    queryFn: () => api.get<Contract[]>('/contracts'),
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

export function useDeposits() {
  return useQuery({
    queryKey: queryKeys.financial.deposits.list(),
    queryFn: () => api.get<Deposit[]>('/financial/deposits'),
  });
}

export function useCreateDeposit(callbacks?: MutationCallbacks<Deposit>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Deposit, 'id' | 'createdAt' | 'createdBy'>) =>
      api.post<Deposit>('/financial/deposits', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.deposits.all });
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

export function useReceivables() {
  return useQuery({
    queryKey: queryKeys.financial.receivables.list(),
    queryFn: () => api.get<AccountsReceivable[]>('/financial/receivables'),
  });
}

export function useCreateReceivable(callbacks?: MutationCallbacks<AccountsReceivable>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<AccountsReceivable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'>) =>
      api.post<AccountsReceivable>('/financial/receivables', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.receivables.all });
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

export function usePayables() {
  return useQuery({
    queryKey: queryKeys.financial.payables.list(),
    queryFn: () => api.get<AccountsPayable[]>('/financial/payables'),
  });
}

export function useCreatePayable(callbacks?: MutationCallbacks<AccountsPayable>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<AccountsPayable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'>) =>
      api.post<AccountsPayable>('/financial/payables', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financial.payables.all });
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
