/**
 * Modo de cálculo do IRA POR TURMA.
 *
 * O modo é uma propriedade da MATRIZ CURRICULAR atribuída à turma
 * (`classes.curriculum_matrix_id` → `curriculum_matrices.ira_calculation_mode`).
 * Nunca é inferido pelo nome da matriz: sempre pelo registro/ID.
 *
 * Matrizes de média aritmética simples (ex.: Matriz Integral) têm carga semanal
 * NULA por definição — usar o modo ponderado nelas zeraria todos os pesos.
 */
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_IRA_MODE, IraCalculationMode, parseIraMode } from '@/lib/ira';

export interface ClassIraModeRef {
  id: string;
  curriculum_matrix_id: string | null;
}

/** PURO: mapa turma → modo. Sem matriz atribuída ou desconhecida = padrão ponderado. */
export function buildIraModeByClass(
  classes: ClassIraModeRef[],
  modeByMatrixId: Record<string, IraCalculationMode>,
): Map<string, IraCalculationMode> {
  const out = new Map<string, IraCalculationMode>();
  classes.forEach((c) => {
    const mode = c.curriculum_matrix_id ? modeByMatrixId[c.curriculum_matrix_id] : undefined;
    out.set(c.id, mode ?? DEFAULT_IRA_MODE);
  });
  return out;
}

/** Modo do IRA das matrizes informadas, em lote e sempre no escopo da escola. */
export async function fetchIraModeByMatrixId(
  matrixIds: (string | null | undefined)[],
  schoolId: string | null | undefined,
): Promise<Record<string, IraCalculationMode>> {
  const ids = [...new Set(matrixIds.filter(Boolean) as string[])];
  if (ids.length === 0 || !schoolId) return {};
  const { data, error } = await supabase
    .from('curriculum_matrices')
    .select('id, ira_calculation_mode')
    .eq('school_id', schoolId)
    .in('id', ids);
  if (error) {
    console.error('Falha ao carregar o modo de cálculo do IRA das matrizes:', error);
    return {};
  }
  const out: Record<string, IraCalculationMode> = {};
  ((data ?? []) as { id: string; ira_calculation_mode: string | null }[]).forEach((m) => {
    out[m.id] = parseIraMode(m.ira_calculation_mode);
  });
  return out;
}

/** Modo do IRA de cada turma (uma única consulta em lote). */
export async function fetchIraModeByClass(
  classes: ClassIraModeRef[],
  schoolId: string | null | undefined,
): Promise<Map<string, IraCalculationMode>> {
  if (classes.length === 0) return new Map();
  const modeByMatrix = await fetchIraModeByMatrixId(
    classes.map((c) => c.curriculum_matrix_id), schoolId,
  );
  return buildIraModeByClass(classes, modeByMatrix);
}
