/**
 * MATRIZ CURRICULAR OFICIAL POR SÉRIE.
 *
 * Fonte da verdade da carga semanal por série: `curriculum_matrix_subjects`.
 * A identidade canônica da disciplina (nome/abreviação/aliases) continua em
 * `mapping_global_subjects`. `default_weekly_classes` passa a ser apenas
 * fallback de compatibilidade.
 */
import { supabase } from '@/integrations/supabase/client';
import { HighSchoolSeries } from '@/lib/series';
import { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';

export * from '@/lib/curriculumMatrixCore';

interface RawRow {
  id: string;
  subject_id: string;
  series: string;
  weekly_classes: number;
  include_in_ira: boolean;
  mapping_global_subjects: {
    name: string; abbreviation: string | null; aliases: string[] | null;
  } | null;
}

/** Carrega a matriz oficial (opcionalmente de uma série), ordenada por nome. */
export async function fetchCurriculumMatrix(series?: HighSchoolSeries): Promise<CurriculumMatrixItem[]> {
  let query = supabase
    .from('curriculum_matrix_subjects')
    .select('id, subject_id, series, weekly_classes, include_in_ira, mapping_global_subjects(name, abbreviation, aliases)');
  if (series) query = query.eq('series', series);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawRow[])
    .filter((r) => r.mapping_global_subjects)
    .map((r) => ({
      id: r.id,
      subject_id: r.subject_id,
      series: r.series as HighSchoolSeries,
      weekly_classes: r.weekly_classes,
      include_in_ira: r.include_in_ira,
      name: r.mapping_global_subjects!.name,
      abbreviation: r.mapping_global_subjects!.abbreviation,
      aliases: r.mapping_global_subjects!.aliases ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

