/**
 * dataClient — routes every CRUD call to either the localStorage mockStore
 * or Supabase, depending on env vars at startup time.
 *
 * useMock === true  →  demo mode (default; no backend needed)
 * useMock === false →  live Supabase (requires VITE_SUPABASE_URL + ANON_KEY)
 */

import * as mock from './mockStore';
import { supabase } from './supabase';
import { toCamelCaseKeys, toSnakeCaseKeys } from './utils';
import { ApiRequestError } from './api';

const useMock =
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_URL === 'https://missing-supabase-url.invalid';

type TableName = Parameters<typeof mock.list>[0];

// Map our camelCase table names to Supabase snake_case table names
const SB_TABLE: Record<TableName, string> = {
  patients: 'patients',
  providers: 'providers',
  staff: 'staff_members',
  testCatalog: 'test_catalog',
  orders: 'test_orders',
  specimens: 'specimens',
  results: 'test_results',
  instruments: 'instruments',
  reagents: 'reagents',
  invoices: 'invoices',
  claims: 'insurance_claims',
  qcRuns: 'qc_runs',
};

function sbError(error: unknown): ApiRequestError {
  const e = error as any;
  const code: string = e.code ?? 'UNKNOWN';
  const statusCode =
    code === 'PGRST301' ? 401
    : code === 'PGRST116' ? 404
    : code === '42501' ? 403
    : code === '23505' || code === '23503' ? 409
    : 500;
  return new ApiRequestError({ message: e.message ?? String(error), code, statusCode });
}

// ---- LIST ----

export async function listRecords<T>(table: TableName): Promise<T[]> {
  if (useMock) return mock.list<T>(table);
  const { data, error } = await supabase.from(SB_TABLE[table]).select('*').order('created_at', { ascending: false });
  if (error) throw sbError(error);
  return ((data ?? []) as unknown[]).map((r) => toCamelCaseKeys(r)) as T[];
}

// ---- GET ----

export async function getRecord<T>(table: TableName, id: string): Promise<T> {
  if (useMock) {
    const rec = mock.get<T>(table, id);
    if (!rec) throw new ApiRequestError({ message: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
    return rec;
  }
  const { data, error } = await supabase.from(SB_TABLE[table]).select('*').eq('id', id).single();
  if (error) throw sbError(error);
  return toCamelCaseKeys(data) as T;
}

// ---- CREATE ----

export async function createRecord<T>(table: TableName, data: Partial<T>): Promise<T> {
  if (useMock) return mock.create<T>(table, data as any);
  const payload = toSnakeCaseKeys({ ...data, id: (data as any).id ?? crypto.randomUUID() });
  const { data: row, error } = await supabase.from(SB_TABLE[table]).insert(payload as any).select().single();
  if (error) throw sbError(error);
  return toCamelCaseKeys(row) as T;
}

// ---- UPDATE ----

export async function updateRecord<T extends { id: string }>(table: TableName, id: string, data: Partial<T>): Promise<T> {
  if (useMock) return mock.update<T>(table, id, data);
  const payload = toSnakeCaseKeys(data);
  const { data: row, error } = await supabase.from(SB_TABLE[table]).update(payload as any).eq('id', id).select().single();
  if (error) throw sbError(error);
  return toCamelCaseKeys(row) as T;
}

// ---- DELETE ----

export async function deleteRecord(table: TableName, id: string): Promise<void> {
  if (useMock) { mock.remove(table, id); return; }
  const { error } = await supabase.from(SB_TABLE[table]).delete().eq('id', id);
  if (error) throw sbError(error);
}

// ---- RESET (demo only) ----

export function resetDemo(): void {
  mock.reset();
}

export { useMock };
