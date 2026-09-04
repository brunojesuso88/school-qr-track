/**
 * Núcleo PURO da matriz curricular por série (sem acesso a rede/banco).
 */
import { HighSchoolSeries } from '@/lib/series';
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';
import { LocalExpectedSubject } from '@/lib/gradePageLocal/types';

export interface CurriculumMatrixItem {
  id: string;
  /** Matriz curricular nomeada a que o componente pertence. */
  matrix_id?: string;
  subject_id: string;
  series: HighSchoolSeries;
  /** `null` em matrizes sem carga semanal (ex. Matriz Integral, IRA aritmético). */
  weekly_classes: number | null;
  include_in_ira: boolean;
  /** Ocorrência do componente na série (1 = única/primeira). */
  slot_index: number;
  name: string;
  abbreviation: string | null;
  aliases: string[];
}

/** Total real de aulas semanais de uma lista da matriz (componentes sem carga contam 0). */
export const matrixWeeklyTotal = (items: { weekly_classes: number | null }[]) =>
  items.reduce((sum, i) => sum + (i.weekly_classes || 0), 0);

/** Converte a matriz oficial em disciplinas esperadas (âncoras) do parser local. */
export const matrixToExpectedSubjects = (items: CurriculumMatrixItem[]): LocalExpectedSubject[] =>
  items.map((i) => ({
    name: i.name,
    weekly_classes: i.weekly_classes,
    slot_index: i.slot_index ?? 1,
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
  // Ocorrências extras (slot > 1) não existem na camada auxiliar de mapeamento.
  return matrix.filter((m) => {
    if ((m.slot_index ?? 1) > 1) return false;
    const keys = [m.name, ...(m.aliases ?? [])].map((k) => canonicalSubjectKey(k));
    return !keys.some((k) => have.has(k));
  });
}

/**
 * Componentes já presentes na turma cuja carga semanal difere da matriz oficial.
 * Nunca sobrescrevemos: apenas relatamos a divergência ao gestor.
 * Componentes sem carga na matriz (IRA aritmético) nunca geram divergência.
 */
export function findMatrixWeeklyDivergences(
  matrix: CurriculumMatrixItem[],
  existing: { subject_name: string; weekly_classes: number | null }[],
): { name: string; current: number | null; expected: number }[] {
  const out: { name: string; current: number | null; expected: number }[] = [];
  for (const row of existing ?? []) {
    const key = canonicalSubjectKey(row.subject_name);
    const item = matrix.find((m) => [m.name, ...(m.aliases ?? [])].some((k) => canonicalSubjectKey(k) === key));
    if (!item || item.weekly_classes == null) continue;
    if ((row.weekly_classes ?? null) !== item.weekly_classes) {
      out.push({ name: row.subject_name, current: row.weekly_classes ?? null, expected: item.weekly_classes });
    }
  }
  return out;
}