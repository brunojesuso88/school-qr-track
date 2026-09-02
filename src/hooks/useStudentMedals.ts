import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ClassGradesData, GradePeriodRow, GradeSubjectRow, IraSettingsRow, StudentGradeRow,
  fetchGradesPaged,
} from './useStudentGrades';
import { computeMedals, MedalStudentInput, StudentMedal } from '@/lib/medals/compute';
import { parseSeriesValue } from '@/lib/series';
import { isPeriodKind, periodRank } from '@/lib/gradePageLocal/normalize';
import { fetchMatrixWeeklyByKey } from '@/lib/curriculumMatrixWeekly';
import { useActiveSchoolId } from '@/contexts/SchoolContext';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Medalhas acadêmicas por SÉRIE, carregadas em lote (sem N+1).
 *
 * O universo da disputa são TODAS as turmas da série dos alunos visíveis,
 * portanto o loader busca as turmas/alunos da série inteira.
 */
export function useStudentMedals(visible: { id: string; class: string }[]) {
  const activeSchoolId = useActiveSchoolId();
  const [medalsByStudent, setMedalsByStudent] = useState<Record<string, StudentMedal[]>>({});
  const [loading, setLoading] = useState(false);

  const classNames = useMemo(
    () => [...new Set(visible.map((s) => s.class).filter(Boolean))].sort(),
    [visible],
  );
  const classKey = classNames.join('|');

  useEffect(() => {
    let active = true;
    if (classNames.length === 0 || !activeSchoolId) {
      setMedalsByStudent({});
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { data: classRows, error: classErr } = await supabase
          .from('classes')
          .select('id, name, series')
          .eq('school_id', activeSchoolId);
        if (classErr) throw classErr;
        const all = (classRows || []) as { id: string; name: string; series: string | null }[];

        // Séries envolvidas pelos alunos visíveis
        const visibleNorm = new Set(classNames.map(norm));
        const seriesInScope = new Set(
          all
            .filter((c) => visibleNorm.has(norm(c.name)))
            .map((c) => parseSeriesValue(c.series))
            .filter(Boolean) as string[],
        );
        if (seriesInScope.size === 0) {
          if (active) setMedalsByStudent({});
          return;
        }

        // Todas as turmas dessas séries (universo da disputa)
        const scopeClasses = all.filter((c) => {
          const s = parseSeriesValue(c.series);
          return s != null && seriesInScope.has(s);
        });
        const classIds = scopeClasses.map((c) => c.id);
        const seriesByClassId = new Map(scopeClasses.map((c) => [c.id, parseSeriesValue(c.series)]));
        const classIdByNormName = new Map(scopeClasses.map((c) => [norm(c.name), c.id]));

        const [studentsRes, subjRes, perRes, settingsRes] = await Promise.all([
          supabase.from('students').select('id, class').eq('school_id', activeSchoolId).in('class', scopeClasses.map((c) => c.name)),
          supabase.from('grade_subjects').select('*').eq('school_id', activeSchoolId).in('class_id', classIds).eq('legacy_excluded', false).order('sort_order'),
          supabase.from('grade_periods').select('*').eq('school_id', activeSchoolId).in('class_id', classIds).order('sort_order'),
          supabase.from('ira_settings').select('*').eq('school_id', activeSchoolId).in('class_id', classIds),
        ]);
        if (subjRes.error) throw subjRes.error;
        if (perRes.error) throw perRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const studentRows = (studentsRes.data || []) as { id: string; class: string }[];
        const subjects = (subjRes.data || []) as unknown as GradeSubjectRow[];
        const periods = ((perRes.data || []) as unknown as GradePeriodRow[])
          .filter((p) => isPeriodKind(p.kind))
          .sort((a, b) => periodRank(a.label) - periodRank(b.label) || a.sort_order - b.sort_order);
        const settings = (settingsRes.data || []) as unknown as IraSettingsRow[];

        const grades: StudentGradeRow[] = await fetchGradesPaged(subjects.map((s) => s.id), undefined, activeSchoolId);

        const mappingIds = subjects.map((s) => s.mapping_class_subject_id).filter(Boolean) as string[];
        const currentWeeklyClasses: Record<string, number> = {};
        if (mappingIds.length > 0) {
          const { data } = await supabase
            .from('mapping_class_subjects')
            .select('id, weekly_classes')
            .eq('school_id', activeSchoolId)
            .in('id', mappingIds);
          (data || []).forEach((row: { id: string; weekly_classes: number }) => {
            currentWeeklyClasses[row.id] = row.weekly_classes;
          });
        }

        const matrixWeeklyByKey = await fetchMatrixWeeklyByKey([...seriesInScope], activeSchoolId);

        const dataByClass = new Map<string, ClassGradesData>();
        classIds.forEach((classId) => {
          const classSubjectIds = new Set(subjects.filter((s) => s.class_id === classId).map((s) => s.id));
          dataByClass.set(classId, {
            subjects: subjects.filter((s) => s.class_id === classId),
            periods: periods.filter((p) => p.class_id === classId),
            grades: grades.filter((g) => classSubjectIds.has(g.grade_subject_id)),
            settings: settings.find((s) => s.class_id === classId) ?? null,
            currentWeeklyClasses,
            matrixWeeklyByKey,
          });
        });

        const inputs: MedalStudentInput[] = [];
        studentRows.forEach((s) => {
          const classId = classIdByNormName.get(norm(s.class));
          const data = classId ? dataByClass.get(classId) : undefined;
          if (!classId || !data) return;
          inputs.push({ studentId: s.id, series: seriesByClassId.get(classId) ?? null, data });
        });

        const result = computeMedals(inputs);
        if (active) setMedalsByStudent(result);
      } catch (e) {
        console.error('Falha ao calcular medalhas por série:', e);
        if (active) setMedalsByStudent({});
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey, activeSchoolId]);

  return { medalsByStudent, loading };
}
