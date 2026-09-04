/**
 * Carga semanal OFICIAL por identidade canônica de disciplina, lida da matriz
 * curricular da série (`curriculum_matrix_subjects`).
 *
 * Existe porque turmas sem vínculo de mapeamento (`mapping_class_subject_id`
 * nulo) ficavam com `grade_subjects.weekly_classes` nulo: sem peso, a disciplina
 * era considerada inelegível e desaparecia do IRA e das medalhas, produzindo
 * valores que não correspondiam às notas exibidas na aba Notas.
 */
import { supabase } from '@/integrations/supabase/client';
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';

export interface MatrixWeeklyRow {
  series: string;
  weekly_classes: number;
  name: string;
  aliases: string[] | null;
}

/** Puro: monta o mapa canônico (nome + aliases) -> carga semanal. */
export function buildMatrixWeeklyByKey(rows: MatrixWeeklyRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.weekly_classes == null) return;
    [r.name, ...(r.aliases ?? [])].forEach((n) => {
      const key = canonicalSubjectKey(n);
      if (key && out[key] == null) out[key] = r.weekly_classes;
    });
  });
  return out;
}

/** Carrega a carga semanal oficial das séries informadas. */
export async function fetchMatrixWeeklyByKey(
  series: (string | null | undefined)[],
  schoolId: string | null | undefined,
  matrixIds?: (string | null | undefined)[],
): Promise<Record<string, number>> {
  const list = [...new Set(series.filter(Boolean) as string[])];
  if (list.length === 0 || !schoolId) return {};
  const matrices = [...new Set((matrixIds ?? []).filter(Boolean) as string[])];
  let query = supabase
    .from('curriculum_matrix_subjects')
    .select('series, weekly_classes, matrix_id, curriculum_matrices(is_original), mapping_global_subjects(name, aliases)')
    .eq('school_id', schoolId)
    .in('series', list);
  if (matrices.length > 0) query = query.in('matrix_id', matrices);
  const { data, error } = await query;
  if (error) {
    console.error('Falha ao carregar carga semanal da matriz curricular:', error);
    return {};
  }
  const rows = ((data ?? []) as unknown as {
    series: string;
    weekly_classes: number;
    curriculum_matrices: { is_original: boolean } | null;
    mapping_global_subjects: { name: string; aliases: string[] | null } | null;
  }[])
    .filter((r) => r.mapping_global_subjects)
    // Sem filtro explícito de matriz, a Matriz Original tem prioridade (primeira vence).
    .sort((a, b) => Number(b.curriculum_matrices?.is_original) - Number(a.curriculum_matrices?.is_original))
    .map((r) => ({
      series: r.series,
      weekly_classes: r.weekly_classes,
      name: r.mapping_global_subjects!.name,
      aliases: r.mapping_global_subjects!.aliases,
    }));
  return buildMatrixWeeklyByKey(rows);
}
