/**
 * Regra PURA de participação no IRA ao criar `grade_subjects` na importação do boletim.
 *
 * Ordem de decisão (idêntica para TODAS as matrizes):
 * 1) escolha do usuário já registrada na turma (nunca é sobrescrita);
 * 2) definição da MATRIZ da turma para aquele componente/slot;
 * 3) participa quando a carga semanal é 1, 2 ou 4 aulas (carga 0/nula não participa
 *    automaticamente, mas pode ser marcada manualmente ou pela matriz).
 */
import { AUTO_WEIGHTS, hasWeeklyLoad } from '@/lib/ira';

export function resolveIncludeInIra(input: {
  previous?: boolean | null;
  matrixIncludeInIra?: boolean | null;
  weeklyClasses?: number | null;
}): boolean {
  if (input.previous != null) return input.previous;
  if (input.matrixIncludeInIra != null) return input.matrixIncludeInIra;
  return hasWeeklyLoad(input.weeklyClasses)
    && (AUTO_WEIGHTS as readonly number[]).includes(input.weeklyClasses as number);
}
