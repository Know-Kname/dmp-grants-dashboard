/**
 * Demo/Preview Mode
 *
 * Demo mode lets the app be shown without a live database connection. It gates
 * *authentication* only — the data hooks still talk to Supabase — so the single
 * demo user below is all the mock data that is actually reachable.
 *
 * Six large DEMO_* datasets (work orders, grants, burials, customers, inventory,
 * dashboard stats) used to live here with no importers at all: nothing ever
 * served them, because the hooks were never branched on demo mode. They were
 * removed rather than left to imply a fallback that does not exist.
 */

import type { User } from '../types';

/** Identity used while demo mode is active. */
export const DEMO_USER: User = {
  id: 'demo-user-001',
  email: 'demo@detroitmemorialpark.org',
  name: 'Demo User',
  role: 'admin',
  createdAt: '2024-01-01T00:00:00.000Z',
};

/** localStorage key backing demo mode. Declared once so readers cannot drift. */
const DEMO_MODE_KEY = 'dmp-demo-mode';

/**
 * Event fired whenever demo mode is toggled.
 *
 * `AuthProvider` listens for it so the change is reactive: a plain localStorage
 * write is invisible to React within the same tab.
 */
export const DEMO_CHANGE_EVENT = 'dmp-demo-change';

/** Whether demo mode is currently active. */
export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

/** Turn demo mode on and notify listeners. */
export function enableDemoMode(): void {
  localStorage.setItem(DEMO_MODE_KEY, 'true');
  window.dispatchEvent(new CustomEvent(DEMO_CHANGE_EVENT, { detail: true }));
}

/** Turn demo mode off and notify listeners. */
export function disableDemoMode(): void {
  localStorage.removeItem(DEMO_MODE_KEY);
  window.dispatchEvent(new CustomEvent(DEMO_CHANGE_EVENT, { detail: false }));
}
