/**
 * useData — React Query hooks for all 12 LIMS entities.
 *
 * makeCrudHooks<T>(table) generates useList/useCreate/useUpdate/useRemove
 * hooks. Orders get custom hooks to handle nested items[].
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/query';
import {
  listRecords, getRecord, createRecord, updateRecord, deleteRecord,
} from '../lib/dataClient';
import type {
  Patient, Provider, StaffMember, TestCatalogItem, TestOrder, OrderItem,
  Specimen, TestResult, Instrument, Reagent, Invoice, InsuranceClaim, QCRun,
} from '../types';

type TableName =
  | 'patients' | 'providers' | 'staff' | 'testCatalog'
  | 'specimens' | 'results' | 'instruments' | 'reagents'
  | 'invoices' | 'claims' | 'qcRuns';

type QK = typeof queryKeys;
type QKGroup = QK[keyof QK];

function makeCrudHooks<T extends { id: string }>(
  table: TableName,
  keyGroup: QKGroup,
) {
  const keys = keyGroup as { all: readonly string[]; list: () => readonly string[] };

  function useList() {
    return useQuery({
      queryKey: keys.list(),
      queryFn: () => listRecords<T>(table),
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) =>
        createRecord<T>(table, data as Partial<T>),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
        updateRecord<T>(table, id, data),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useRemove() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => deleteRecord(table, id),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
    });
  }

  return { useList, useCreate, useUpdate, useRemove };
}

// ============================================
// PATIENTS
// ============================================

const _patients = makeCrudHooks<Patient>('patients', queryKeys.patients);
export const usePatients = _patients.useList;
export const useCreatePatient = _patients.useCreate;
export const useUpdatePatient = _patients.useUpdate;

export function useRemovePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Check for dependent orders before deleting
      const orders = await listRecords<TestOrder>('orders');
      if (orders.some((o) => o.patientId === id)) {
        throw new Error('Cannot delete patient: they have existing orders. Cancel or delete orders first.');
      }
      return deleteRecord('patients', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.patients.all }),
  });
}

// ============================================
// PROVIDERS
// ============================================

const _providers = makeCrudHooks<Provider>('providers', queryKeys.providers);
export const useProviders = _providers.useList;
export const useCreateProvider = _providers.useCreate;
export const useUpdateProvider = _providers.useUpdate;

export function useRemoveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const orders = await listRecords<TestOrder>('orders');
      if (orders.some((o) => o.providerId === id)) {
        throw new Error('Cannot delete provider: they have existing orders. Reassign or cancel orders first.');
      }
      return deleteRecord('providers', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.providers.all }),
  });
}

// ============================================
// STAFF
// ============================================

const _staff = makeCrudHooks<StaffMember>('staff', queryKeys.staff);
export const useStaff = _staff.useList;
export const useCreateStaff = _staff.useCreate;
export const useUpdateStaff = _staff.useUpdate;
export const useRemoveStaff = _staff.useRemove;

// ============================================
// TEST CATALOG
// ============================================

const _catalog = makeCrudHooks<TestCatalogItem>('testCatalog', queryKeys.testCatalog);
export const useTestCatalog = _catalog.useList;
export const useCreateTestCatalogItem = _catalog.useCreate;
export const useUpdateTestCatalogItem = _catalog.useUpdate;
export const useRemoveTestCatalogItem = _catalog.useRemove;

// ============================================
// ORDERS (custom — nested items)
// ============================================

export function useOrders() {
  return useQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: () => listRecords<TestOrder>('orders'),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => getRecord<TestOrder>('orders', id),
    enabled: !!id,
  });
}

interface OrderCreateInput {
  orderNumber: string;
  patientId: string;
  providerId: string;
  priority: TestOrder['priority'];
  status: TestOrder['status'];
  orderedDate: string;
  clinicalNotes?: string;
  icd10Codes?: string[];
  items: Array<{ testCatalogId: string; testName: string; price: number }>;
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrderCreateInput) => {
      const orderId = crypto.randomUUID();
      const now = new Date().toISOString();
      const items: OrderItem[] = input.items.map((it) => ({
        id: crypto.randomUUID(),
        orderId,
        testCatalogId: it.testCatalogId,
        testName: it.testName,
        price: it.price,
        status: 'pending' as const,
        createdAt: now,
        updatedAt: now,
      }));
      const order: Omit<TestOrder, 'createdAt' | 'updatedAt'> = {
        id: orderId,
        orderNumber: input.orderNumber,
        patientId: input.patientId,
        providerId: input.providerId,
        priority: input.priority,
        status: input.status,
        orderedDate: input.orderedDate,
        clinicalNotes: input.clinicalNotes,
        icd10Codes: input.icd10Codes,
        items,
      };
      return createRecord<TestOrder>('orders', order as Partial<TestOrder>);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OrderCreateInput> }) => {
      const now = new Date().toISOString();
      const updatePayload: Partial<TestOrder> = {
        patientId: data.patientId,
        providerId: data.providerId,
        priority: data.priority,
        status: data.status,
        orderedDate: data.orderedDate,
        clinicalNotes: data.clinicalNotes,
        icd10Codes: data.icd10Codes,
      };
      if (data.items) {
        updatePayload.items = data.items.map((it) => ({
          id: crypto.randomUUID(),
          orderId: id,
          testCatalogId: it.testCatalogId,
          testName: it.testName,
          price: it.price,
          status: 'pending' as const,
          createdAt: now,
          updatedAt: now,
        }));
      }
      return updateRecord<TestOrder>('orders', id, updatePayload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

export function useRemoveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const specimens = await listRecords<Specimen>('specimens');
      if (specimens.some((s) => s.orderId === id)) {
        throw new Error('Cannot delete order: specimens have been collected. Archive or dispose specimens first.');
      }
      return deleteRecord('orders', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

// ============================================
// SPECIMENS
// ============================================

const _specimens = makeCrudHooks<Specimen>('specimens', queryKeys.specimens);
export const useSpecimens = _specimens.useList;
export const useCreateSpecimen = _specimens.useCreate;
export const useUpdateSpecimen = _specimens.useUpdate;
export const useRemoveSpecimen = _specimens.useRemove;

// ============================================
// RESULTS
// ============================================

const _results = makeCrudHooks<TestResult>('results', queryKeys.results);
export const useResults = _results.useList;
export const useCreateResult = _results.useCreate;
export const useUpdateResult = _results.useUpdate;
export const useRemoveResult = _results.useRemove;

// ============================================
// INSTRUMENTS
// ============================================

const _instruments = makeCrudHooks<Instrument>('instruments', queryKeys.instruments);
export const useInstruments = _instruments.useList;
export const useCreateInstrument = _instruments.useCreate;
export const useUpdateInstrument = _instruments.useUpdate;
export const useRemoveInstrument = _instruments.useRemove;

// ============================================
// REAGENTS
// ============================================

const _reagents = makeCrudHooks<Reagent>('reagents', queryKeys.reagents);
export const useReagents = _reagents.useList;
export const useCreateReagent = _reagents.useCreate;
export const useUpdateReagent = _reagents.useUpdate;
export const useRemoveReagent = _reagents.useRemove;

// ============================================
// INVOICES
// ============================================

const _invoices = makeCrudHooks<Invoice>('invoices', queryKeys.invoices);
export const useInvoices = _invoices.useList;
export const useCreateInvoice = _invoices.useCreate;
export const useUpdateInvoice = _invoices.useUpdate;
export const useRemoveInvoice = _invoices.useRemove;

// ============================================
// INSURANCE CLAIMS
// ============================================

const _claims = makeCrudHooks<InsuranceClaim>('claims', queryKeys.claims);
export const useClaims = _claims.useList;
export const useCreateClaim = _claims.useCreate;
export const useUpdateClaim = _claims.useUpdate;
export const useRemoveClaim = _claims.useRemove;

// ============================================
// QC RUNS
// ============================================

const _qcRuns = makeCrudHooks<QCRun>('qcRuns', queryKeys.qcRuns);
export const useQCRuns = _qcRuns.useList;
export const useCreateQCRun = _qcRuns.useCreate;
export const useUpdateQCRun = _qcRuns.useUpdate;
export const useRemoveQCRun = _qcRuns.useRemove;
