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
import { fetchOriginalMatrixId } from '@/lib/curriculumMatrices';

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
    // Carga 0 = "não informada": não serve de fallback.
    if (r.weekly_classes == null || r.weekly_classes <= 0) return;
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

/* ------------------------------------------------------------------ *
 * Carga semanal POR TURMA: cada turma usa a matriz que lhe foi
 * atribuída (`classes.curriculum_matrix_id`). Nunca compartilhamos um
 * único mapa escolar entre turmas — duas turmas da mesma série podem
 * usar matrizes diferentes, com cargas diferentes.
 * ------------------------------------------------------------------ */

export interface ClassMatrixRef {
  id: string;
  series: string | null;
  curriculum_matrix_id: string | null;
}

export interface MatrixWeeklyScopedRow extends MatrixWeeklyRow {
  matrix_id: string;
}

/**
 * PURO: mapa de carga semanal por turma, agrupado por (matriz, série).
 * `originalMatrixId` cobre dados legados sem matriz atribuída — nunca mistura matrizes.
 */
export function buildMatrixWeeklyByClass(
  classes: ClassMatrixRef[],
  rows: MatrixWeeklyScopedRow[],
  originalMatrixId: string | null,
): Map<string, Record<string, number>> {
  const byGroup = new Map<string, MatrixWeeklyScopedRow[]>();
  rows.forEach((r) => {
    const key = `${r.matrix_id}::${r.series}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
  });

  const cache = new Map<string, Record<string, number>>();
  const out = new Map<string, Record<string, number>>();
  classes.forEach((c) => {
    const series = c.series;
    const matrixId = c.curriculum_matrix_id ?? originalMatrixId;
    if (!series || !matrixId) { out.set(c.id, {}); return; }
    const key = `${matrixId}::${series}`;
    if (!cache.has(key)) cache.set(key, buildMatrixWeeklyByKey(byGroup.get(key) ?? []));
    out.set(c.id, cache.get(key)!);
  });
  return out;
}

/**
 * Carga semanal da matriz de CADA turma (uma única consulta agrupada por matriz+série).
 * A série recebida em `classes[].series` deve estar já normalizada ('1' | '2' | '3').
 */
export async function fetchMatrixWeeklyByClass(
  classes: ClassMatrixRef[],
  schoolId: string | null | undefined,
): Promise<Map<string, Record<string, number>>> {
  if (!schoolId || classes.length === 0) return new Map();

  const needsOriginal = classes.some((c) => !c.curriculum_matrix_id && c.series);
  const originalMatrixId = needsOriginal ? await fetchOriginalMatrixId(schoolId) : null;

  const matrixIds = [...new Set(
    classes.map((c) => c.curriculum_matrix_id ?? originalMatrixId).filter(Boolean) as string[],
  )];
  const seriesList = [...new Set(classes.map((c) => c.series).filter(Boolean) as string[])];
  if (matrixIds.length === 0 || seriesList.length === 0) {
    return new Map(classes.map((c) => [c.id, {} as Record<string, number>]));
  }

  const { data, error } = await supabase
    .from('curriculum_matrix_subjects')
    .select('matrix_id, series, weekly_classes, mapping_global_subjects(name, aliases)')
    .eq('school_id', schoolId)
    .in('matrix_id', matrixIds)
    .in('series', seriesList);
  if (error) {
    console.error('Falha ao carregar carga semanal por turma:', error);
    return new Map(classes.map((c) => [c.id, {} as Record<string, number>]));
  }

  const rows = ((data ?? []) as unknown as {
    matrix_id: string;
    series: string;
    weekly_classes: number;
    mapping_global_subjects: { name: string; aliases: string[] | null } | null;
  }[])
    .filter((r) => r.mapping_global_subjects)
    .map((r) => ({
      matrix_id: r.matrix_id,
      series: r.series,
      weekly_classes: r.weekly_classes,
      name: r.mapping_global_subjects!.name,
      aliases: r.mapping_global_subjects!.aliases,
    }));

  return buildMatrixWeeklyByClass(classes, rows, originalMatrixId);
}

