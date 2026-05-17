/**
 * localStorage-backed typed table store for demo mode.
 * All CRUD is synchronous; React Query re-reads after invalidation.
 */

import { seedDb } from './demo-data';
import { brand } from '../config/brand';

const STORAGE_KEY = `${brand.storagePrefix}mock-db`;

type TableName =
  | 'patients'
  | 'providers'
  | 'staff'
  | 'testCatalog'
  | 'orders'
  | 'specimens'
  | 'results'
  | 'instruments'
  | 'reagents'
  | 'invoices'
  | 'claims'
  | 'qcRuns';

type Db = Record<TableName, Record<string, unknown>[]>;

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* corrupt data — reseed */
  }
  return seedAndSave();
}

function saveDb(db: Db): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function seedAndSave(): Db {
  const db = seedDb() as unknown as Db;
  saveDb(db);
  return db;
}

// ---- public API ----

export function list<T>(table: TableName): T[] {
  return (loadDb()[table] as T[]) ?? [];
}

export function get<T>(table: TableName, id: string): T | undefined {
  return (loadDb()[table] as T[]).find((r: any) => r.id === id);
}

export function create<T extends { id?: string }>(table: TableName, data: T): T {
  const db = loadDb();
  const now = new Date().toISOString();
  const record = {
    ...data,
    id: data.id ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } as T;
  (db[table] as unknown[]).push(record);
  saveDb(db);
  return record;
}

export function update<T extends { id: string }>(table: TableName, id: string, data: Partial<T>): T {
  const db = loadDb();
  const rows = db[table] as any[];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`${table}/${id} not found`);
  const updated = { ...rows[idx], ...data, updatedAt: new Date().toISOString() } as T;
  rows[idx] = updated;
  saveDb(db);
  return updated;
}

export function remove(table: TableName, id: string): void {
  const db = loadDb();
  const rows = db[table] as any[];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`${table}/${id} not found`);
  rows.splice(idx, 1);
  saveDb(db);
}

export function reset(): void {
  seedAndSave();
}

/** Replace all rows in a table atomically (used for order items). */
export function replaceTable<T>(table: TableName, rows: T[]): void {
  const db = loadDb();
  db[table] = rows as Record<string, unknown>[];
  saveDb(db);
}
