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
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';
import { LocalExpectedSubject } from '@/lib/gradePageLocal/types';

export interface CurriculumMatrixItem {
  id: string;
  subject_id: string;
  series: HighSchoolSeries;
  weekly_classes: number;
  include_in_ira: boolean;
  name: string;
  abbreviation: string | null;
  aliases: string[];
}

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

/** Total real de aulas semanais de uma lista da matriz. */
export const matrixWeeklyTotal = (items: { weekly_classes: number }[]) =>
  items.reduce((sum, i) => sum + (i.weekly_classes || 0), 0);

/** Converte a matriz oficial em disciplinas esperadas (âncoras) do parser local. */
export const matrixToExpectedSubjects = (items: CurriculumMatrixItem[]): LocalExpectedSubject[] =>
  items.map((i) => ({
    name: i.name,
    weekly_classes: i.weekly_classes,
    aliases: i.aliases,
    abbreviation: i.abbreviation,
    origin: ['matrix'],
  }));

/**
 * Componentes da matriz da série que AINDA NÃO existem na turma.
 * Comparação por identidade canônica (aliases dos Aprofundamentos incluídos),
 * então `APROFUNDAMENTO IF - CNS - I` já existente não gera duplicata.
 */
export function selectMissingMatrixSubjects(
  matrix: CurriculumMatrixItem[],
  existing: { subject_name: string }[],
): CurriculumMatrixItem[] {
  const have = new Set((existing ?? []).map((e) => canonicalSubjectKey(e.subject_name)));
  return matrix.filter((m) => {
    const keys = [m.name, ...(m.aliases ?? [])].map((k) => canonicalSubjectKey(k));
    return !keys.some((k) => have.has(k));
  });
}

/**
 * Componentes já presentes na turma cuja carga semanal difere da matriz oficial.
 * Nunca sobrescrevemos: apenas relatamos a divergência ao gestor.
 */
export function findMatrixWeeklyDivergences(
  matrix: CurriculumMatrixItem[],
  existing: { subject_name: string; weekly_classes: number | null }[],
): { name: string; current: number | null; expected: number }[] {
  const out: { name: string; current: number | null; expected: number }[] = [];
  for (const row of existing ?? []) {
    const key = canonicalSubjectKey(row.subject_name);
    const item = matrix.find((m) => [m.name, ...(m.aliases ?? [])].some((k) => canonicalSubjectKey(k) === key));
    if (!item) continue;
    if ((row.weekly_classes ?? null) !== item.weekly_classes) {
      out.push({ name: row.subject_name, current: row.weekly_classes ?? null, expected: item.weekly_classes });
    }
  }
  return out;
}