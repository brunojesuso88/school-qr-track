/**
 * Regra PURA de participação no IRA ao criar `grade_subjects` na importação do boletim.
 *
 * Ordem de decisão:
 * 1) escolha do usuário já registrada na turma (nunca é sobrescrita);
 * 2) definição da MATRIZ da turma para aquele componente/slot;
 * 3) matriz de média aritmética (ex.: Matriz Integral): participa por padrão,
 *    pois carga semanal não existe nessas matrizes;
 * 4) matriz ponderada: participa quando a carga é 1, 2 ou 4 aulas.
 */
import { AUTO_WEIGHTS, IraCalculationMode } from '@/lib/ira';

export function resolveIncludeInIra(input: {
  previous?: boolean | null;
  matrixIncludeInIra?: boolean | null;
  mode: IraCalculationMode;
  weeklyClasses?: number | null;
}): boolean {
  if (input.previous != null) return input.previous;
  if (input.matrixIncludeInIra != null) return input.matrixIncludeInIra;
  if (input.mode === 'arithmetic') return true;
  return input.weeklyClasses != null
    && (AUTO_WEIGHTS as readonly number[]).includes(input.weeklyClasses);
}
