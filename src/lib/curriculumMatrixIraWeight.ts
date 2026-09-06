/**
 * PESO EXPLÍCITO DO IRA lido da matriz curricular (`curriculum_matrix_subjects.ira_weight`).
 *
 * REGRAS DE SEGURANÇA (associação nunca ambígua):
 *  1. a associação preferencial é ESTRUTURAL:
 *     `grade_subjects.curriculum_matrix_subject_id -> curriculum_matrix_subjects.id`;
 *  2. `slot_index` desambigua componentes legítimos repetidos na mesma matriz+série;
 *  3. o fallback textual (nome canônico) só entrega peso quando existe UMA ÚNICA
 *     correspondência inequívoca na matriz+série efetiva. Com 0 ou >1 candidatos o
 *     peso é `null` (pendente) — nunca "o primeiro".
 *  4. a carga semanal (`weekly_classes`) NUNCA deriva peso.
 *
 * A matriz efetiva da turma é `classes.curriculum_matrix_id`; sem ela, a MATRIZ
 * VIGENTE DA ESCOLA (`schools.curriculum_matrix_id`) e, apenas como último recurso
 * legado, a Matriz Original.
 */
import { supabase } from '@/integrations/supabase/client';
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';
import { fetchOriginalMatrixId, fetchSchoolMatrixId } from '@/lib/curriculumMatrices';
import type { ClassMatrixRef } from '@/lib/curriculumMatrixWeekly';

export interface MatrixIraWeightRow {
  /** `curriculum_matrix_subjects.id` — chave estrutural. */
  id: string;
  series: string;
  slot_index: number | null;
  ira_weight: number | null;
  name: string;
  aliases: string[] | null;
}

export interface MatrixIraWeightScopedRow extends MatrixIraWeightRow {
  matrix_id: string;
}

/**
 * Índice de pesos explícitos de uma matriz+série.
 * `byKey` contém SOMENTE chaves canônicas com correspondência única.
 */
export interface MatrixIraWeightIndex {
  /** `curriculum_matrix_subjects.id` -> peso explícito. */
  byComponentId: Record<string, number>;
  /** `${chaveCanônica}::${slot_index}` -> peso explícito. */
  bySlotKey: Record<string, number>;
  /** chave canônica -> peso, apenas quando há UM único componente candidato. */
  byKey: Record<string, number>;
}

export const emptyIraWeightIndex = (): MatrixIraWeightIndex => ({
  byComponentId: {}, bySlotKey: {}, byKey: {},
});

const validWeight = (w: number | null | undefined): number | null =>
  w != null && Number.isFinite(w) && w > 0 ? w : null;

export const slotKey = (name: string, slot: number | null | undefined): string | null => {
  const key = canonicalSubjectKey(name);
  return key && slot != null ? `${key}::${slot}` : null;
};

/** PURO — índice seguro de pesos explícitos de uma matriz+série. */
export function buildMatrixIraWeightIndex(rows: MatrixIraWeightRow[]): MatrixIraWeightIndex {
  const index = emptyIraWeightIndex();
  /** chave canônica -> ids de componentes distintos que a reivindicam. */
  const candidates = new Map<string, Map<string, number>>();

  rows.forEach((r) => {
    const weight = validWeight(r.ira_weight);
    if (weight == null) return;
    index.byComponentId[r.id] = weight;
    [r.name, ...(r.aliases ?? [])].forEach((n) => {
      const key = canonicalSubjectKey(n);
      if (!key) return;
      if (r.slot_index != null) index.bySlotKey[`${key}::${r.slot_index}`] = weight;
      const bucket = candidates.get(key) ?? new Map<string, number>();
      bucket.set(r.id, weight);
      candidates.set(key, bucket);
    });
  });

  // Fallback textual só quando a correspondência é ÚNICA e inequívoca.
  candidates.forEach((bucket, key) => {
    if (bucket.size !== 1) return;
    const [weight] = [...bucket.values()];
    const distinct = new Set(bucket.values());
    if (distinct.size === 1) index.byKey[key] = weight;
  });

  return index;
}

/** PURO — índice por turma, agrupado por (matriz, série). Nunca mistura matrizes. */
export function buildMatrixIraWeightByClass(
  classes: ClassMatrixRef[],
  rows: MatrixIraWeightScopedRow[],
  fallbackMatrixId: string | null,
): Map<string, MatrixIraWeightIndex> {
  const byGroup = new Map<string, MatrixIraWeightScopedRow[]>();
  rows.forEach((r) => {
    const key = `${r.matrix_id}::${r.series}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
  });

  const cache = new Map<string, MatrixIraWeightIndex>();
  const out = new Map<string, MatrixIraWeightIndex>();
  classes.forEach((c) => {
    const matrixId = c.curriculum_matrix_id ?? fallbackMatrixId;
    if (!c.series || !matrixId) { out.set(c.id, emptyIraWeightIndex()); return; }
    const key = `${matrixId}::${c.series}`;
    if (!cache.has(key)) cache.set(key, buildMatrixIraWeightIndex(byGroup.get(key) ?? []));
    out.set(c.id, cache.get(key)!);
  });
  return out;
}

/**
 * PURO — peso explícito de uma linha de notas.
 * Ordem: peso do próprio `grade_subject` > componente estrutural >
 * `slot_index` > correspondência textual única > pendente (`null`).
 */
export function resolveExplicitIraWeight(
  subject: {
    name: string;
    ira_weight?: number | null;
    curriculum_matrix_subject_id?: string | null;
    slot_index?: number | null;
  },
  index: MatrixIraWeightIndex | undefined,
): number | null {
  const own = validWeight(subject.ira_weight);
  if (own != null) return own;
  if (!index) return null;
  if (subject.curriculum_matrix_subject_id) {
    // Vínculo estrutural existe: ele é a ÚNICA fonte válida (sem cair no nome).
    return index.byComponentId[subject.curriculum_matrix_subject_id] ?? null;
  }
  const sKey = slotKey(subject.name, subject.slot_index);
  if (sKey && index.bySlotKey[sKey] != null) return index.bySlotKey[sKey];
  const key = canonicalSubjectKey(subject.name);
  return (key && index.byKey[key]) ?? null;
}

const COMPONENT_SELECT =
  'id, matrix_id, series, slot_index, ira_weight, mapping_global_subjects(name, aliases)';

interface RawComponentRow {
  id: string;
  matrix_id: string;
  series: string;
  slot_index: number | null;
  ira_weight: number | null;
  mapping_global_subjects: { name: string; aliases: string[] | null } | null;
}

const toScopedRows = (data: unknown): MatrixIraWeightScopedRow[] =>
  ((data ?? []) as RawComponentRow[])
    .filter((r) => r.mapping_global_subjects)
    .map((r) => ({
      id: r.id,
      matrix_id: r.matrix_id,
      series: r.series,
      slot_index: r.slot_index,
      ira_weight: r.ira_weight,
      name: r.mapping_global_subjects!.name,
      aliases: r.mapping_global_subjects!.aliases,
    }));

/**
 * Matriz efetiva quando a turma não tem `curriculum_matrix_id`: a VIGENTE da escola;
 * a Matriz Original é apenas último recurso legado.
 */
export async function fetchEffectiveMatrixId(
  schoolId: string | null | undefined,
): Promise<string | null> {
  if (!schoolId) return null;
  try {
    const current = await fetchSchoolMatrixId(schoolId);
    if (current) return current;
  } catch (error) {
    console.error('Falha ao ler a matriz vigente da escola:', error);
  }
  return fetchOriginalMatrixId(schoolId);
}

/** Índice de pesos explícitos de uma turma (série + matriz efetiva). */
export async function fetchMatrixIraWeightIndex(
  series: string | null | undefined,
  schoolId: string | null | undefined,
  matrixId: string | null | undefined,
): Promise<MatrixIraWeightIndex> {
  if (!series || !schoolId) return emptyIraWeightIndex();
  const effective = matrixId ?? (await fetchEffectiveMatrixId(schoolId));
  if (!effective) return emptyIraWeightIndex();
  const { data, error } = await supabase
    .from('curriculum_matrix_subjects')
    .select(COMPONENT_SELECT)
    .eq('school_id', schoolId)
    .eq('matrix_id', effective)
    .eq('series', series);
  if (error) {
    console.error('Falha ao carregar o peso do IRA da matriz curricular:', error);
    return emptyIraWeightIndex();
  }
  return buildMatrixIraWeightIndex(toScopedRows(data));
}

/** Índice de pesos explícitos da matriz de CADA turma (uma consulta agrupada). */
export async function fetchMatrixIraWeightByClass(
  classes: ClassMatrixRef[],
  schoolId: string | null | undefined,
): Promise<Map<string, MatrixIraWeightIndex>> {
  if (!schoolId || classes.length === 0) return new Map();

  const needsFallback = classes.some((c) => !c.curriculum_matrix_id && c.series);
  const fallbackMatrixId = needsFallback ? await fetchEffectiveMatrixId(schoolId) : null;

  const matrixIds = [...new Set(
    classes.map((c) => c.curriculum_matrix_id ?? fallbackMatrixId).filter(Boolean) as string[],
  )];
  const seriesList = [...new Set(classes.map((c) => c.series).filter(Boolean) as string[])];
  const emptyMap = () => new Map(classes.map((c) => [c.id, emptyIraWeightIndex()]));
  if (matrixIds.length === 0 || seriesList.length === 0) return emptyMap();

  const { data, error } = await supabase
    .from('curriculum_matrix_subjects')
    .select(COMPONENT_SELECT)
    .eq('school_id', schoolId)
    .in('matrix_id', matrixIds)
    .in('series', seriesList);
  if (error) {
    console.error('Falha ao carregar o peso do IRA por turma:', error);
    return emptyMap();
  }

  return buildMatrixIraWeightByClass(classes, toScopedRows(data), fallbackMatrixId);
}
