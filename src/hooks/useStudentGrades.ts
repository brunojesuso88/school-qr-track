import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateIra, IraResult, IraSubjectInput } from '@/lib/ira';

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
  use_final_grade: boolean;
  scale_max: number;
}

export interface ClassGradesData {
  subjects: GradeSubjectRow[];
  periods: GradePeriodRow[];
  grades: StudentGradeRow[];
  settings: IraSettingsRow | null;
  currentWeeklyClasses: Record<string, number>;
}

const emptyData: ClassGradesData = {
  subjects: [],
  periods: [],
  grades: [],
  settings: null,
  currentWeeklyClasses: {},
};

/** Resolve o período usado no IRA conforme a configuração da turma. */
export function resolveIraPeriod(data: ClassGradesData): GradePeriodRow | null {
  if (data.settings?.use_final_grade) {
    return data.periods.find((p) => p.kind === 'final') ?? null;
  }
  if (data.settings?.ira_period_id) {
    return data.periods.find((p) => p.id === data.settings?.ira_period_id) ?? null;
  }
  return null;
}

/** Monta as entradas do cálculo do IRA para um aluno. */
export function buildIraInputs(
  data: ClassGradesData,
  studentId: string,
  periodId: string | null,
): IraSubjectInput[] {
  return data.subjects.map((subject) => {
    const current = subject.mapping_class_subject_id
      ? data.currentWeeklyClasses[subject.mapping_class_subject_id]
      : undefined;
    const weekly = current ?? subject.weekly_classes ?? null;
    const grade = periodId
      ? data.grades.find(
          (g) => g.student_id === studentId && g.grade_subject_id === subject.id && g.grade_period_id === periodId,
        )
      : undefined;
    return {
      subjectId: subject.id,
      name: subject.name,
      weeklyClasses: weekly,
      includeInIra: subject.include_in_ira,
      customWeight: subject.custom_ira_weight,
      value: grade?.value ?? null,
      rawText: grade?.raw_text ?? null,
    };
  });
}

export function computeIraForStudent(data: ClassGradesData, studentId: string): IraResult {
  const period = resolveIraPeriod(data);
  return calculateIra(buildIraInputs(data, studentId, period?.id ?? null), {
    periodLabel: period?.label ?? null,
    hasPeriodConfigured: !!period,
  });
}

async function fetchClassGrades(classId: string, studentIds?: string[]): Promise<ClassGradesData> {
  const [subjectsRes, periodsRes, settingsRes] = await Promise.all([
    supabase.from('grade_subjects').select('*').eq('class_id', classId).order('sort_order'),
    supabase.from('grade_periods').select('*').eq('class_id', classId).order('sort_order'),
    supabase.from('ira_settings').select('*').eq('class_id', classId).maybeSingle(),
  ]);

  const subjects = (subjectsRes.data || []) as unknown as GradeSubjectRow[];
  const periods = (periodsRes.data || []) as unknown as GradePeriodRow[];
  const subjectIds = subjects.map((s) => s.id);

  let grades: StudentGradeRow[] = [];
  if (subjectIds.length > 0) {
    let query = supabase.from('student_grades').select('*').in('grade_subject_id', subjectIds);
    if (studentIds && studentIds.length > 0) query = query.in('student_id', studentIds);
    const { data } = await query;
    grades = ((data || []) as unknown as StudentGradeRow[]).map((g) => ({ ...g, flags: g.flags || [] }));
  }

  // Carga semanal atual do mapeamento escolar (quando há vínculo)
  const mappingIds = subjects.map((s) => s.mapping_class_subject_id).filter(Boolean) as string[];
  const currentWeeklyClasses: Record<string, number> = {};
  if (mappingIds.length > 0) {
    const { data } = await supabase
      .from('mapping_class_subjects')
      .select('id, weekly_classes')
      .in('id', mappingIds);
    (data || []).forEach((row: { id: string; weekly_classes: number }) => {
      currentWeeklyClasses[row.id] = row.weekly_classes;
    });
  }

  return {
    subjects,
    periods,
    grades,
    settings: (settingsRes.data as unknown as IraSettingsRow) ?? null,
    currentWeeklyClasses,
  };
}

/** Carrega notas + configuração de IRA de uma turma inteira (em lote). */
export function useClassGrades(classId: string | null, studentIds?: string[]) {
  const [data, setData] = useState<ClassGradesData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idsKey = (studentIds || []).join(',');

  const load = useCallback(async () => {
    if (!classId) {
      setData(emptyData);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchClassGrades(classId, studentIds));
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar as notas.');
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, idsKey]);

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
  const iraPeriod = useMemo(() => resolveIraPeriod(data), [data]);

  const gradeMap = useMemo(() => {
    const map = new Map<string, StudentGradeRow>();
    data.grades
      .filter((g) => !studentId || g.student_id === studentId)
      .forEach((g) => map.set(`${g.grade_subject_id}||${g.grade_period_id}`, g));
    return map;
  }, [data.grades, studentId]);

  return { data, gradeMap, ira, iraPeriod, loading, error, reload };
}