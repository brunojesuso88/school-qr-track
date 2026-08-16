/**
 * Serviço ÚNICO de herança curricular: TURMA → SÉRIE → MATRIZ OFICIAL → DISCIPLINAS DE NOTAS/IRA.
 *
 * Fonte da verdade: `curriculum_matrix_subjects` (por série).
 * Nunca apaga notas: disciplinas fora da matriz são marcadas `legacy_excluded`
 * e saem da visualização e do IRA, preservando o histórico.
 */
import { supabase } from '@/integrations/supabase/client';
import { HighSchoolSeries, parseSeriesValue } from '@/lib/series';
import { fetchCurriculumMatrix } from '@/lib/curriculumMatrix';
import { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';
import {
  ClassCurriculumPlan, ExistingGradeSubject, ExistingMappingSubject, planClassCurriculumSync,
} from '@/lib/classCurriculum/plan';

export * from '@/lib/classCurriculum/plan';

export interface ClassCurriculumState {
  series: HighSchoolSeries;
  matrix: CurriculumMatrixItem[];
  mappingClassId: string | null;
  plan: ClassCurriculumPlan;
}

async function loadState(classId: string, series: HighSchoolSeries): Promise<ClassCurriculumState> {
  const [matrix, classRow, gradeRes] = await Promise.all([
    fetchCurriculumMatrix(series),
    supabase.from('classes').select('id, mapping_class_id').eq('id', classId).maybeSingle(),
    supabase
      .from('grade_subjects')
      .select('id, name, weekly_classes, include_in_ira, legacy_excluded, mapping_class_subject_id, sort_order')
      .eq('class_id', classId),
  ]);
  if (classRow.error) throw classRow.error;
  if (gradeRes.error) throw gradeRes.error;

  const gradeRows = (gradeRes.data ?? []) as ExistingGradeSubject[];
  let gradeSubjects: ExistingGradeSubject[] = gradeRows;
  if (gradeRows.length > 0) {
    const { data: usedRows, error } = await supabase
      .from('student_grades')
      .select('grade_subject_id')
      .in('grade_subject_id', gradeRows.map((g) => g.id));
    if (error) throw error;
    const used = new Set((usedRows ?? []).map((r) => r.grade_subject_id));
    gradeSubjects = gradeRows.map((g) => ({ ...g, hasGrades: used.has(g.id) }));
  }

  const mappingClassId = (classRow.data?.mapping_class_id as string | null) ?? null;
  let mappingSubjects: ExistingMappingSubject[] = [];
  if (mappingClassId) {
    const { data, error } = await supabase
      .from('mapping_class_subjects')
      .select('id, subject_name, weekly_classes')
      .eq('class_id', mappingClassId);
    if (error) throw error;
    mappingSubjects = (data ?? []) as ExistingMappingSubject[];
  }

  return {
    series,
    matrix,
    mappingClassId,
    // Sem `mapping_class_id` a camada auxiliar é ignorada por completo: nada de
    // mappingCreate/mappingUpdate pendentes travando o gate de importação.
    plan: planClassCurriculumSync({
      matrix, mappingSubjects, gradeSubjects, manageMapping: Boolean(mappingClassId),
    }),
  };
}

/** Inspeciona (sem escrever) o alinhamento da turma com a matriz oficial da série. */
export async function inspectClassCurriculum(
  classId: string,
  series: string | null | undefined,
): Promise<ClassCurriculumState | null> {
  const parsed = parseSeriesValue(series);
  if (!parsed) return null;
  return loadState(classId, parsed);
}

export interface SyncResult extends ClassCurriculumState {
  applied: ClassCurriculumPlan['counts'];
}

/**
 * Aplica a herança curricular na turma. Idempotente: rodar de novo não duplica nada.
 * Quando `persistSeries` é `true`, grava também `classes.series`.
 */
export async function syncClassCurriculum(
  classId: string,
  series: string,
  options: { persistSeries?: boolean } = {},
): Promise<SyncResult> {
  const parsed = parseSeriesValue(series);
  if (!parsed) throw new Error('Série da turma inválida — selecione 1º, 2º ou 3º ano do Ensino Médio.');

  if (options.persistSeries !== false) {
    const { error } = await supabase.from('classes').update({ series: parsed }).eq('id', classId);
    if (error) throw error;
  }

  const state = await loadState(classId, parsed);
  const { plan, mappingClassId } = state;

  // 1) Mapeamento acadêmico (base da carga semanal usada em relatórios).
  if (mappingClassId) {
    if (plan.mappingCreate.length > 0) {
      const { error } = await supabase.from('mapping_class_subjects').insert(
        plan.mappingCreate.map((m, i) => ({
          class_id: mappingClassId,
          subject_name: m.subject_name,
          weekly_classes: m.weekly_classes,
          sort_order: i,
        })),
      );
      if (error) throw error;
    }
    for (const upd of plan.mappingUpdate) {
      const { error } = await supabase
        .from('mapping_class_subjects')
        .update({ weekly_classes: upd.weekly_classes })
        .eq('id', upd.id);
      if (error) throw error;
    }
  }

  // 2) Disciplinas de notas faltantes.
  if (plan.gradeCreate.length > 0) {
    const { error } = await supabase.from('grade_subjects').insert(
      plan.gradeCreate.map((g) => ({ ...g, class_id: classId })),
    );
    if (error) throw error;
  }

  // 3) Disciplinas existentes realinhadas com a matriz (nome, carga, ordem, IRA).
  for (const upd of plan.gradeUpdate) {
    const { id, ...patch } = upd;
    const { error } = await supabase.from('grade_subjects').update(patch).eq('id', id);
    if (error) throw error;
  }

  // 4) Legadas: fora da UI e do IRA, com histórico intacto.
  if (plan.gradeLegacy.length > 0) {
    const { error } = await supabase
      .from('grade_subjects')
      .update({ legacy_excluded: true, include_in_ira: false })
      .in('id', plan.gradeLegacy.map((g) => g.id));
    if (error) throw error;
  }

  const after = await loadState(classId, parsed);
  return { ...after, applied: plan.counts };
}
