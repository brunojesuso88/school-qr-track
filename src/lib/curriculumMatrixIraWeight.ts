/**
 * PESO EXPLÍCITO DO IRA por identidade canônica de disciplina, lido da matriz
 * curricular (`curriculum_matrix_subjects.ira_weight`).
 *
 * A carga semanal NÃO participa: quando `grade_subjects.ira_weight` está ausente,
 * o peso é herdado do COMPONENTE equivalente da matriz da turma (peso explícito,
 * 1/2/4). Sem correspondência na matriz, a disciplina fica pendente.
 */
import { supabase } from '@/integrations/supabase/client';
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';
import { fetchOriginalMatrixId } from '@/lib/curriculumMatrices';
import type { ClassMatrixRef } from '@/lib/curriculumMatrixWeekly';

export interface MatrixIraWeightRow {
  series: string;
  ira_weight: number | null;
  name: string;
  aliases: string[] | null;
}

export interface MatrixIraWeightScopedRow extends MatrixIraWeightRow {
  matrix_id: string;
}

/** PURO — mapa canônico (nome + aliases) -> peso explícito do IRA. */
export function buildMatrixIraWeightByKey(rows: MatrixIraWeightRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.ira_weight == null || !Number.isFinite(r.ira_weight) || r.ira_weight <= 0) return;
    [r.name, ...(r.aliases ?? [])].forEach((n) => {
      const key = canonicalSubjectKey(n);
      if (key && out[key] == null) out[key] = r.ira_weight as number;
    });
  });
  return out;
}

/** PURO — peso explícito por turma, agrupado por (matriz, série). Nunca mistura matrizes. */
export function buildMatrixIraWeightByClass(
  classes: ClassMatrixRef[],
  rows: MatrixIraWeightScopedRow[],
  originalMatrixId: string | null,
): Map<string, Record<string, number>> {
  const byGroup = new Map<string, MatrixIraWeightScopedRow[]>();
  rows.forEach((r) => {
    const key = `${r.matrix_id}::${r.series}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
  });

  const cache = new Map<string, Record<string, number>>();
  const out = new Map<string, Record<string, number>>();
  classes.forEach((c) => {
    const matrixId = c.curriculum_matrix_id ?? originalMatrixId;
    if (!c.series || !matrixId) { out.set(c.id, {}); return; }
    const key = `${matrixId}::${c.series}`;
    if (!cache.has(key)) cache.set(key, buildMatrixIraWeightByKey(byGroup.get(key) ?? []));
    out.set(c.id, cache.get(key)!);
  });
  return out;
}

/** Peso explícito da(s) série(s) informada(s), opcionalmente restrito a matrizes. */
export async function fetchMatrixIraWeightByKey(
  series: (string | null | undefined)[],
  schoolId: string | null | undefined,
  matrixIds?: (string | null | undefined)[],
): Promise<Record<string, number>> {
  const list = [...new Set(series.filter(Boolean) as string[])];
  if (list.length === 0 || !schoolId) return {};
  const matrices = [...new Set((matrixIds ?? []).filter(Boolean) as string[])];
  let query = supabase
    .from('curriculum_matrix_subjects')
    .select('series, ira_weight, matrix_id, curriculum_matrices(is_original), mapping_global_subjects(name, aliases)')
    .eq('school_id', schoolId)
    .in('series', list);
  if (matrices.length > 0) query = query.in('matrix_id', matrices);
  const { data, error } = await query;
  if (error) {
    console.error('Falha ao carregar o peso do IRA da matriz curricular:', error);
    return {};
  }
  const rows = ((data ?? []) as unknown as {
    series: string;
    ira_weight: number | null;
    curriculum_matrices: { is_original: boolean } | null;
    mapping_global_subjects: { name: string; aliases: string[] | null } | null;
  }[])
    .filter((r) => r.mapping_global_subjects)
    .sort((a, b) => Number(b.curriculum_matrices?.is_original) - Number(a.curriculum_matrices?.is_original))
    .map((r) => ({
      series: r.series,
      ira_weight: r.ira_weight,
      name: r.mapping_global_subjects!.name,
      aliases: r.mapping_global_subjects!.aliases,
    }));
  return buildMatrixIraWeightByKey(rows);
}

/** Peso explícito da matriz de CADA turma (uma consulta agrupada por matriz+série). */
export async function fetchMatrixIraWeightByClass(
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
    .select('matrix_id, series, ira_weight, mapping_global_subjects(name, aliases)')
    .eq('school_id', schoolId)
    .in('matrix_id', matrixIds)
    .in('series', seriesList);
  if (error) {
    console.error('Falha ao carregar o peso do IRA por turma:', error);
    return new Map(classes.map((c) => [c.id, {} as Record<string, number>]));
  }

  const rows = ((data ?? []) as unknown as {
    matrix_id: string;
    series: string;
    ira_weight: number | null;
    mapping_global_subjects: { name: string; aliases: string[] | null } | null;
  }[])
    .filter((r) => r.mapping_global_subjects)
    .map((r) => ({
      matrix_id: r.matrix_id,
      series: r.series,
      ira_weight: r.ira_weight,
      name: r.mapping_global_subjects!.name,
      aliases: r.mapping_global_subjects!.aliases,
    }));

  return buildMatrixIraWeightByClass(classes, rows, originalMatrixId);
}
