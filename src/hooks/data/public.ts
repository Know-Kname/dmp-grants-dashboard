/**
 * Unauthenticated reads for public memorial pages.
 *
 * @see ./_shared for the pieces every module here shares.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/query';
import type { Burial } from '../../types';
import { fromRow } from './_shared';

// ============================================
// PUBLIC (UNAUTHENTICATED) — MEMORIAL PAGES
// ============================================

export function usePublicBurial(id: string) {
  return useQuery({
    queryKey: queryKeys.burials.memorial(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('burials')
        .select('id, deceased_first_name, deceased_last_name, deceased_middle_name, date_of_birth, date_of_death, burial_date, plot_location, section, lot, grave, memorial_published')
        .eq('id', id)
        .eq('memorial_published', true)
        .single();
      if (error) throw new Error(error.message);
      return fromRow<Burial>(data);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
