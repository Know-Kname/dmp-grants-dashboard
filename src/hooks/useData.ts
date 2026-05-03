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
  Vendor,
  Burial,
  Contract,
  Deposit,
  AccountsReceivable,
  AccountsPayable,
  PaymentScheduleEntry,
  Cemetery,
  Section,
  Lot,
  Grave,
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
// VENDORS
// ============================================

export function useVendors() {
  return useQuery({
    queryKey: queryKeys.vendors.list(),
    queryFn: () => api.get<Vendor[]>('/vendors'),
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: () => api.get<Vendor>(`/vendors/${id}`),
    enabled: !!id,
  });
}

export function useCreateVendor(callbacks?: MutationCallbacks<Vendor>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Vendor>('/vendors', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateVendor(callbacks?: MutationCallbacks<Vendor>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Vendor> & { id: string }) =>
      api.put<Vendor>(`/vendors/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteVendor(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/vendors/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// PAYMENT SCHEDULE
// ============================================

export function usePaymentSchedule(contractId: string) {
  return useQuery({
    queryKey: queryKeys.paymentSchedule.byContract(contractId),
    queryFn: () => api.get<PaymentScheduleEntry[]>(`/payment-schedule?contractId=${contractId}`),
    enabled: !!contractId,
  });
}

export function useCreatePaymentScheduleEntry(callbacks?: MutationCallbacks<PaymentScheduleEntry>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PaymentScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<PaymentScheduleEntry>('/payment-schedule', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSchedule.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdatePaymentScheduleEntry(callbacks?: MutationCallbacks<PaymentScheduleEntry>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<PaymentScheduleEntry> & { id: string }) =>
      api.put<PaymentScheduleEntry>(`/payment-schedule/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSchedule.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

// ============================================
// CEMETERY HIERARCHY
// ============================================

export function useCemeteries() {
  return useQuery({
    queryKey: queryKeys.cemeteries.list(),
    queryFn: () => api.get<Cemetery[]>('/cemeteries'),
  });
}

export function useCreateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Cemetery, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Cemetery>('/cemeteries', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cemeteries.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Cemetery> & { id: string }) =>
      api.put<Cemetery>(`/cemeteries/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cemeteries.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteCemetery(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/cemeteries/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cemeteries.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useSections(cemeteryId: string) {
  return useQuery({
    queryKey: queryKeys.sections.byCemetery(cemeteryId),
    queryFn: () => api.get<Section[]>('/sections', { params: { cemeteryId } }),
    enabled: !!cemeteryId,
  });
}

export function useCreateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Section, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Section>('/sections', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Section> & { id: string }) =>
      api.put<Section>(`/sections/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteSection(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/sections/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useLots(sectionId: string) {
  return useQuery({
    queryKey: queryKeys.lots.bySection(sectionId),
    queryFn: () => api.get<Lot[]>('/lots', { params: { sectionId } }),
    enabled: !!sectionId,
  });
}

export function useCreateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Lot>('/lots', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Lot> & { id: string }) =>
      api.put<Lot>(`/lots/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteLot(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/lots/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useGraves(lotId: string) {
  return useQuery({
    queryKey: queryKeys.graves.byLot(lotId),
    queryFn: () => api.get<Grave[]>('/graves', { params: { lotId } }),
    enabled: !!lotId,
  });
}

export function useCreateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Grave, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.post<Grave>('/graves', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graves.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useUpdateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Grave> & { id: string }) =>
      api.put<Grave>(`/graves/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graves.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}

export function useDeleteGrave(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/graves/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graves.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
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
