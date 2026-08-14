import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateIra, IraResult } from '@/lib/ira';
import {
  ClassGradesData, GradePeriodRow, GradeSubjectRow, IraSettingsRow, StudentGradeRow,
  buildIraInputs, resolveIraPeriod,
} from './useStudentGrades';

/**
 * Calcula o IRA de vários alunos em lote (poucas queries, independente da
 * quantidade de alunos visíveis).
 */
export function useStudentsIra(students: { id: string; class: string }[]) {
  const [iraByStudent, setIraByStudent] = useState<Record<string, IraResult>>({});
  const [loading, setLoading] = useState(false);

  const classNames = useMemo(
    () => [...new Set(students.map((s) => s.class).filter(Boolean))].sort(),
    [students],
  );
  const studentIds = useMemo(() => students.map((s) => s.id).sort(), [students]);
  const classKey = classNames.join('|');
  const studentKey = studentIds.join('|');

  useEffect(() => {
    let active = true;
    if (classNames.length === 0 || studentIds.length === 0) {
      setIraByStudent({});
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { data: classRows } = await supabase
          .from('classes')
          .select('id, name')
          .in('name', classNames);
        const classIdByName = new Map<string, string>();
        (classRows || []).forEach((c: { id: string; name: string }) => classIdByName.set(c.name, c.id));
        const classIds = [...classIdByName.values()];
        if (classIds.length === 0) {
          if (active) setIraByStudent({});
          return;
        }

        const [subjRes, perRes, settingsRes] = await Promise.all([
          supabase.from('grade_subjects').select('*').in('class_id', classIds).order('sort_order'),
          supabase.from('grade_periods').select('*').in('class_id', classIds).order('sort_order'),
          supabase.from('ira_settings').select('*').in('class_id', classIds),
        ]);
        const subjects = (subjRes.data || []) as unknown as GradeSubjectRow[];
        const periods = (perRes.data || []) as unknown as GradePeriodRow[];
        const settings = (settingsRes.data || []) as unknown as IraSettingsRow[];

        let grades: StudentGradeRow[] = [];
        if (subjects.length > 0) {
          const { data } = await supabase
            .from('student_grades')
            .select('*')
            .in('grade_subject_id', subjects.map((s) => s.id))
            .in('student_id', studentIds);
          grades = ((data || []) as unknown as StudentGradeRow[]).map((g) => ({ ...g, flags: g.flags || [] }));
        }

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

        const result: Record<string, IraResult> = {};
        for (const student of students) {
          const classId = classIdByName.get(student.class);
          if (!classId) continue;
          const data: ClassGradesData = {
            subjects: subjects.filter((s) => s.class_id === classId),
            periods: periods.filter((p) => p.class_id === classId),
            grades,
            settings: settings.find((s) => s.class_id === classId) ?? null,
            currentWeeklyClasses,
          };
          const period = resolveIraPeriod(data);
          result[student.id] = calculateIra(buildIraInputs(data, student.id, period?.id ?? null), {
            periodLabel: period?.label ?? null,
            hasPeriodConfigured: !!period,
          });
        }
        if (active) setIraByStudent(result);
      } catch (e) {
        console.error('Falha ao calcular IRA em lote:', e);
        if (active) setIraByStudent({});
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey, studentKey]);

  return { iraByStudent, loading };
}