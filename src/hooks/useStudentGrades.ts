import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateIraMultiPeriod, IraPeriodRef, IraResult, IraSubjectInput } from '@/lib/ira';
import { canonicalSubjectKey, isPeriodKind, periodRank } from '@/lib/gradePageLocal/normalize';
import { fetchMatrixWeeklyByKey } from '@/lib/curriculumMatrixWeekly';
import { parseSeriesValue } from '@/lib/series';
import { useActiveSchoolId } from '@/contexts/SchoolContext';

export interface GradeSubjectRow {
  id: string;
  class_id: string;
  name: string;
  normalized_name: string;
  mapping_class_subject_id: string | null;
  weekly_classes: number | null;
  include_in_ira: boolean;
  custom_ira_weight: number | null;
  sort_order: number;
}

export interface GradePeriodRow {
  id: string;
  class_id: string;
  label: string;
  normalized_label: string;
  kind: string;
  sort_order: number;
}

export interface StudentGradeRow {
  id: string;
  student_id: string;
  grade_subject_id: string;
  grade_period_id: string;
  value: number | null;
  raw_text: string | null;
  confidence: number | null;
  flags: string[];
  source: string;
}

export interface IraSettingsRow {
  id: string;
  class_id: string;
  ira_period_id: string | null;
  ira_period_ids: string[] | null;
  use_final_grade: boolean;
  scale_max: number;
}

export interface ClassGradesData {
  subjects: GradeSubjectRow[];
  periods: GradePeriodRow[];
  grades: StudentGradeRow[];
  settings: IraSettingsRow | null;
  currentWeeklyClasses: Record<string, number>;
  /**
   * Carga semanal OFICIAL da matriz curricular da série, por identidade canônica
   * da disciplina. Fallback usado quando a turma não tem vínculo de mapeamento
   * (`mapping_class_subject_id` nulo) e `grade_subjects.weekly_classes` está nulo —
   * sem isso a disciplina ficava sem peso e desaparecia silenciosamente do IRA.
   */
  matrixWeeklyByKey?: Record<string, number>;
}

const emptyData: ClassGradesData = {
  subjects: [],
  periods: [],
  grades: [],
  settings: null,
  currentWeeklyClasses: {},
  matrixWeeklyByKey: {},
};

/**
 * Resolve os períodos usados no IRA conforme a configuração da turma.
 * Prioridade: Nota Final -> `ira_period_ids` -> `ira_period_id` (compatibilidade).
 */
export function resolveIraPeriods(data: ClassGradesData): GradePeriodRow[] {
  const settings = data.settings;
  if (!settings) return [];
  if (settings.use_final_grade) {
    const final = data.periods.find((p) => p.kind === 'final');
    return final ? [final] : [];
  }
  const ids = settings.ira_period_ids && settings.ira_period_ids.length > 0
    ? settings.ira_period_ids
    : settings.ira_period_id
      ? [settings.ira_period_id]
      : [];
  // Mantém a ordem de exibição dos períodos da turma
  return data.periods.filter((p) => ids.includes(p.id));
}

export function toPeriodRefs(periods: GradePeriodRow[]): IraPeriodRef[] {
  return periods.map((p) => ({ id: p.id, label: p.label }));
}

/** Monta as entradas do cálculo do IRA (multi-período) para um aluno. */
export function buildIraInputs(
  data: ClassGradesData,
  studentId: string,
  periodIds: string[],
): IraSubjectInput[] {
  const gradesForStudent = data.grades.filter((g) => g.student_id === studentId);
  return data.subjects.map((subject) => {
    const current = subject.mapping_class_subject_id
      ? data.currentWeeklyClasses[subject.mapping_class_subject_id]
      : undefined;
    const fromMatrix = data.matrixWeeklyByKey?.[canonicalSubjectKey(subject.name)];
    const weekly = current ?? subject.weekly_classes ?? fromMatrix ?? null;
    const valuesByPeriod: Record<string, number | null> = {};
    periodIds.forEach((periodId) => {
      const grade = gradesForStudent.find(
        (g) => g.grade_subject_id === subject.id && g.grade_period_id === periodId,
      );
      valuesByPeriod[periodId] = grade?.value ?? null;
    });
    return {
      subjectId: subject.id,
      name: subject.name,
      weeklyClasses: weekly,
      includeInIra: subject.include_in_ira,
      customWeight: subject.custom_ira_weight,
      valuesByPeriod,
    };
  });
}

/** Cálculo canônico do IRA de um aluno — usado pelo card e pelo detalhe. */
export function computeIraForStudent(data: ClassGradesData, studentId: string): IraResult {
  const periods = resolveIraPeriods(data);
  return calculateIraMultiPeriod(
    buildIraInputs(data, studentId, periods.map((p) => p.id)),
    toPeriodRefs(periods),
    {
      notConfiguredReason: data.settings
        ? 'Nenhum período válido selecionado em Configurações → IRA para esta turma'
        : 'Esta turma ainda não tem configuração de IRA (Configurações → IRA)',
    },
  );
}

/**
 * Busca todas as notas em páginas de 1000 linhas (limite padrão do PostgREST),
 * evitando resultados truncados silenciosamente.
 */
export async function fetchGradesPaged(
  subjectIds: string[],
  studentIds: string[] | undefined,
  schoolId: string | null | undefined,
): Promise<StudentGradeRow[]> {
  if (subjectIds.length === 0 || !schoolId) return [];
  const PAGE = 1000;
  // Lotes de disciplinas: uma lista grande em `in(...)` estoura a URL do REST (erro 500).
  const SUBJECT_CHUNK = 60;
  const rows: StudentGradeRow[] = [];
  for (let s = 0; s < subjectIds.length; s += SUBJECT_CHUNK) {
    const subjectChunk = subjectIds.slice(s, s + SUBJECT_CHUNK);
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from('student_grades')
        .select('*')
        .eq('school_id', schoolId)
        .in('grade_subject_id', subjectChunk)
        .order('id')
        .range(from, from + PAGE - 1);
      // Só filtra por aluno quando a lista é curta (URL longa quebra a requisição)
      if (studentIds && studentIds.length > 0 && studentIds.length <= 100) {
        query = query.in('student_id', studentIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      const page = ((data || []) as unknown as StudentGradeRow[]).map((g) => ({ ...g, flags: g.flags || [] }));
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  }
  if (studentIds && studentIds.length > 100) {
    const set = new Set(studentIds);
    return rows.filter((g) => set.has(g.student_id));
  }
  return rows;
}

async function fetchClassGrades(
  classId: string,
  schoolId: string,
  studentIds?: string[],
): Promise<ClassGradesData> {
  const [subjectsRes, periodsRes, settingsRes, classRes] = await Promise.all([
    supabase.from('grade_subjects').select('*').eq('school_id', schoolId).eq('class_id', classId).eq('legacy_excluded', false).order('sort_order'),
    supabase.from('grade_periods').select('*').eq('school_id', schoolId).eq('class_id', classId).order('sort_order'),
    supabase.from('ira_settings').select('*').eq('school_id', schoolId).eq('class_id', classId).maybeSingle(),
    supabase.from('classes').select('series').eq('school_id', schoolId).eq('id', classId).maybeSingle(),
  ]);

  const subjects = (subjectsRes.data || []) as unknown as GradeSubjectRow[];
  // Somente 1º→4º Período alimentam as notas exibidas e o IRA. Colunas finais do boletim
  // (Média Final, Rec. Final, Cons. Class, Pendência, Final) são descartadas na origem.
  const periods = ((periodsRes.data || []) as unknown as GradePeriodRow[])
    .filter((p) => isPeriodKind(p.kind))
    .sort((a, b) => periodRank(a.label) - periodRank(b.label) || a.sort_order - b.sort_order);
  const subjectIds = subjects.map((s) => s.id);

  const grades = await fetchGradesPaged(subjectIds, studentIds, schoolId);

  // Carga semanal atual do mapeamento escolar (quando há vínculo)
  const mappingIds = subjects.map((s) => s.mapping_class_subject_id).filter(Boolean) as string[];
  const currentWeeklyClasses: Record<string, number> = {};
  if (mappingIds.length > 0) {
    const { data } = await supabase
      .from('mapping_class_subjects')
      .select('id, weekly_classes')
      .eq('school_id', schoolId)
      .in('id', mappingIds);
    (data || []).forEach((row: { id: string; weekly_classes: number }) => {
      currentWeeklyClasses[row.id] = row.weekly_classes;
    });
  }

  // Fonte de verdade da carga semanal quando não há vínculo de mapeamento.
  const classInfo = classRes.data as { series: string | null; curriculum_matrix_id?: string | null } | null;
  const series = parseSeriesValue(classInfo?.series ?? null);
  // Carga/participação vêm da matriz efetivamente atribuída à turma.
  const matrixWeeklyByKey = await fetchMatrixWeeklyByKey(
    [series], schoolId, classInfo?.curriculum_matrix_id ? [classInfo.curriculum_matrix_id] : undefined,
  );

  return {
    subjects,
    periods,
    grades,
    settings: (settingsRes.data as unknown as IraSettingsRow) ?? null,
    currentWeeklyClasses,
    matrixWeeklyByKey,
  };
}

/** Carrega notas + configuração de IRA de uma turma inteira (em lote). */
export function useClassGrades(classId: string | null, studentIds?: string[]) {
  const activeSchoolId = useActiveSchoolId();
  const [data, setData] = useState<ClassGradesData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idsKey = (studentIds || []).join(',');

  const load = useCallback(async () => {
    if (!classId || !activeSchoolId) {
      setData(emptyData);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchClassGrades(classId, activeSchoolId, studentIds));
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar as notas.');
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, idsKey, activeSchoolId]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

/** Notas de um aluno específico (usa o carregamento em lote da turma dele). */
export function useStudentGrades(studentId: string | null, classId: string | null) {
  const { data, loading, error, reload } = useClassGrades(
    classId,
    studentId ? [studentId] : undefined,
  );

  const ira = useMemo(
    () => (studentId ? computeIraForStudent(data, studentId) : null),
    [data, studentId],
  );
  const iraPeriods = useMemo(() => resolveIraPeriods(data), [data]);

  const gradeMap = useMemo(() => {
    const map = new Map<string, StudentGradeRow>();
    data.grades
      .filter((g) => !studentId || g.student_id === studentId)
      .forEach((g) => map.set(`${g.grade_subject_id}||${g.grade_period_id}`, g));
    return map;
  }, [data.grades, studentId]);

  return { data, gradeMap, ira, iraPeriods, loading, error, reload };
}