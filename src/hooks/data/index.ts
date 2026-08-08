/**
 * Every data hook, re-exported.
 *
 * `hooks/useData.ts` re-exports this barrel, so the ~40 call sites that import
 * from `../hooks/useData` continue to work untouched. That is what made the
 * split a pure move: no page changed, and the test suite was not edited.
 */
export * from './dashboard';
export * from './workOrders';
export * from './grants';
export * from './inventory';
export * from './customers';
export * from './burials';
export * from './contracts';
export * from './financial';
export * from './vendors';
export * from './cemeteries';
export * from './profiles';
export * from './public';
export type { MutationCallbacks } from './_shared';
