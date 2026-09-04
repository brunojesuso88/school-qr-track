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
import { fetchOriginalMatrixId } from '@/lib/curriculumMatrices';

export * from '@/lib/curriculumMatrixCore';

interface RawRow {
  id: string;
  matrix_id: string;
  subject_id: string;
  series: string;
  weekly_classes: number | null;
  include_in_ira: boolean;
  slot_index: number | null;
  mapping_global_subjects: {
    name: string; abbreviation: string | null; aliases: string[] | null;
  } | null;
}

/**
 * Carrega a matriz curricular (opcionalmente de uma série), ordenada por nome.
 * `matrixId` restringe a uma matriz nomeada da escola; sem ele, lê a Matriz Original.
 */
export async function fetchCurriculumMatrix(
  series: HighSchoolSeries | undefined,
  schoolId: string | null | undefined,
  matrixId?: string | null,
): Promise<CurriculumMatrixItem[]> {
  if (!schoolId) return [];
  const targetMatrix = matrixId ?? (await fetchOriginalMatrixId(schoolId));
  if (!targetMatrix) return [];
  let query = supabase
    .from('curriculum_matrix_subjects')
    .select('id, matrix_id, subject_id, series, weekly_classes, include_in_ira, slot_index, mapping_global_subjects(name, abbreviation, aliases)')
    .eq('school_id', schoolId)
    .eq('matrix_id', targetMatrix);
  if (series) query = query.eq('series', series);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawRow[])
    .filter((r) => r.mapping_global_subjects)
    .map((r) => ({
      id: r.id,
      matrix_id: r.matrix_id,
      subject_id: r.subject_id,
      series: r.series as HighSchoolSeries,
      weekly_classes: r.weekly_classes,
      include_in_ira: r.include_in_ira,
      slot_index: r.slot_index ?? 1,
      name: r.mapping_global_subjects!.name,
      abbreviation: r.mapping_global_subjects!.abbreviation,
      aliases: r.mapping_global_subjects!.aliases ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.slot_index - b.slot_index);
}
