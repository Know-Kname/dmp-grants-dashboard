/**
 * The cemetery → section → lot → grave hierarchy.
 *
 * Each level queries by its parent id and is disabled until that parent is
 * selected, which is what makes the drill-down cheap.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toSnakeCaseKeys } from '../../lib/utils';
import { queryKeys } from '../../lib/query';
import { affectedRow, affectedRows } from '../../lib/writeResult';
import type { Cemetery, Section, Lot, Grave } from '../../types';
import { type MutationCallbacks, type CreateInput, type UpdateInput, fromRow, fromRows, fetchAll, mutationSideEffects, sb } from './_shared';

// ============================================
// CEMETERY HIERARCHY
// ============================================

export function useCemeteries() {
  return useQuery({
    queryKey: queryKeys.cemeteries.list(),
    queryFn: () => fetchAll<Cemetery>('cemeteries', 'name', true),
  });
}

export function useCreateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Cemetery>) => {
      const row = await sb(
        supabase.from('cemeteries')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Cemetery>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.cemeteries.all, callbacks),
  });
}

export function useUpdateCemetery(callbacks?: MutationCallbacks<Cemetery>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Cemetery>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('cemeteries')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Cemetery>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.cemeteries.all, callbacks),
  });
}

export function useDeleteCemetery(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('cemeteries').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.cemeteries.all, callbacks),
  });
}

export function useSections(cemeteryId: string) {
  return useQuery({
    queryKey: queryKeys.sections.byCemetery(cemeteryId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('sections').select('*')
          .eq('cemetery_id', cemeteryId)
          .order('name', { ascending: true })
      );
      return fromRows<Section>(rows);
    },
    enabled: !!cemeteryId,
  });
}

export function useCreateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Section>) => {
      const row = await sb(
        supabase.from('sections')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Section>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.sections.all, callbacks),
  });
}

export function useUpdateSection(callbacks?: MutationCallbacks<Section>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Section>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('sections')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Section>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.sections.all, callbacks),
  });
}

export function useDeleteSection(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('sections').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.sections.all, callbacks),
  });
}

export function useLots(sectionId: string) {
  return useQuery({
    queryKey: queryKeys.lots.bySection(sectionId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('lots').select('*')
          .eq('section_id', sectionId)
          .order('lot_number', { ascending: true })
      );
      return fromRows<Lot>(rows);
    },
    enabled: !!sectionId,
  });
}

export function useCreateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Lot>) => {
      const row = await sb(
        supabase.from('lots')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Lot>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.lots.all, callbacks),
  });
}

export function useUpdateLot(callbacks?: MutationCallbacks<Lot>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Lot>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('lots')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Lot>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.lots.all, callbacks),
  });
}

export function useDeleteLot(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('lots').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.lots.all, callbacks),
  });
}

export function useGraves(lotId: string) {
  return useQuery({
    queryKey: queryKeys.graves.byLot(lotId),
    queryFn: async () => {
      const rows = await sb(
        supabase.from('graves').select('*')
          .eq('lot_id', lotId)
          .order('grave_number', { ascending: true })
      );
      return fromRows<Grave>(rows);
    },
    enabled: !!lotId,
  });
}

export function useCreateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInput<Grave>) => {
      const row = await sb(
        supabase.from('graves')
          .insert(toSnakeCaseKeys(data))
          .select().single()
      );
      return fromRow<Grave>(row);
    },
    ...mutationSideEffects(queryClient, queryKeys.graves.all, callbacks),
  });
}

export function useUpdateGrave(callbacks?: MutationCallbacks<Grave>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInput<Grave>) => {
      // Deliberately no `.single()`: it reports zero rows as a cryptic
      // PGRST116 about JSON coercion. `affectedRow` names the real cause.
      const rows = await sb(
        supabase.from('graves')
          .update(toSnakeCaseKeys(data))
          .eq('id', id).select()
      );
      return fromRow<Grave>(affectedRow(rows, 'update'));
    },
    ...mutationSideEffects(queryClient, queryKeys.graves.all, callbacks),
  });
}

export function useDeleteGrave(callbacks?: MutationCallbacks<{ success: boolean }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // `.select()` so rows come back: an RLS-refused delete is a 200 with
      // zero rows, not an error. See `lib/writeResult`.
      const rows = await sb(supabase.from('graves').delete().eq('id', id).select('id'));
      affectedRows(rows, 'delete');
      return { success: true };
    },
    ...mutationSideEffects(queryClient, queryKeys.graves.all, callbacks),
  });
}
