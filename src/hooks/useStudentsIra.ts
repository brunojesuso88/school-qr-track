import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IraResult } from '@/lib/ira';
import {
  ClassGradesData, GradePeriodRow, GradeSubjectRow, IraSettingsRow, StudentGradeRow,
  computeIraForStudent, fetchGradesPaged,
} from './useStudentGrades';

/**
 * Calcula o IRA de vários alunos em lote (poucas queries, independente da
 * quantidade de alunos visíveis), usando o MESMO motor do detalhe do aluno
 * (`computeIraForStudent`), garantindo card e aba "Notas" idênticos.
 */
export function useStudentsIra(students: { id: string; class: string }[]) {
  const [iraByStudent, setIraByStudent] = useState<Record<string, IraResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Turmas de alunos que não foram encontradas em `classes` (inconsistência de vínculo). */
  const [unmatchedClasses, setUnmatchedClasses] = useState<string[]>([]);

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
      setError(null);
      try {
        // Vínculo aluno→turma disponível na arquitetura atual é o NOME da turma.
        // Carregamos todas as turmas e casamos por nome exato e, como fallback,
        // por nome normalizado, sinalizando inconsistências (nomes duplicados
        // ou turma inexistente) em vez de silenciar.
        const { data: classRows, error: classErr } = await supabase
          .from('classes')
          .select('id, name');
        if (classErr) throw classErr;
        const all = (classRows || []) as { id: string; name: string }[];
        const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const byExact = new Map<string, string[]>();
        const byNorm = new Map<string, string[]>();
        all.forEach((c) => {
          byExact.set(c.name, [...(byExact.get(c.name) || []), c.id]);
          byNorm.set(norm(c.name), [...(byNorm.get(norm(c.name)) || []), c.id]);
        });
        const classIdByName = new Map<string, string>();
        const missing: string[] = [];
        classNames.forEach((name) => {
          const ids = byExact.get(name) ?? byNorm.get(norm(name)) ?? [];
          if (ids.length === 0) {
            missing.push(name);
            return;
          }
          if (ids.length > 1) {
            console.warn(`[IRA] Nome de turma duplicado em classes: "${name}" — usando o primeiro vínculo.`);
          }
          classIdByName.set(name, ids[0]);
        });
        if (active) setUnmatchedClasses(missing);
        const classIds = [...new Set(classIdByName.values())];
        if (classIds.length === 0) {
          if (active) setIraByStudent({});
          return;
        }

        const [subjRes, perRes, settingsRes] = await Promise.all([
          supabase.from('grade_subjects').select('*').in('class_id', classIds).eq('legacy_excluded', false).order('sort_order'),
          supabase.from('grade_periods').select('*').in('class_id', classIds).order('sort_order'),
          supabase.from('ira_settings').select('*').in('class_id', classIds),
        ]);
        if (subjRes.error) throw subjRes.error;
        if (perRes.error) throw perRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const subjects = (subjRes.data || []) as unknown as GradeSubjectRow[];
        const periods = (perRes.data || []) as unknown as GradePeriodRow[];
        const settings = (settingsRes.data || []) as unknown as IraSettingsRow[];

        // Paginado (o PostgREST devolve no máximo 1000 linhas por requisição) e
        // sem filtrar por centenas de ids de aluno na URL.
        const grades: StudentGradeRow[] = await fetchGradesPaged(
          subjects.map((s) => s.id),
          studentIds,
        );

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

        // Uma estrutura por turma (calculada uma única vez) e o IRA mapeado por aluno.
        const dataByClass = new Map<string, ClassGradesData>();
        classIds.forEach((classId) => {
          const classSubjectIds = new Set(subjects.filter((s) => s.class_id === classId).map((s) => s.id));
          dataByClass.set(classId, {
            subjects: subjects.filter((s) => s.class_id === classId),
            periods: periods.filter((p) => p.class_id === classId),
            grades: grades.filter((g) => classSubjectIds.has(g.grade_subject_id)),
            settings: settings.find((s) => s.class_id === classId) ?? null,
            currentWeeklyClasses,
          });
        });

        const result: Record<string, IraResult> = {};
        for (const student of students) {
          const classId = classIdByName.get(student.class);
          const data = classId ? dataByClass.get(classId) : undefined;
          if (!data) continue;
          result[student.id] = computeIraForStudent(data, student.id);
        }
        if (active) setIraByStudent(result);
      } catch (e) {
        console.error('Falha ao calcular IRA em lote:', e);
        if (active) {
          setError('Não foi possível calcular o IRA em lote.');
          setIraByStudent({});
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey, studentKey]);

  return { iraByStudent, loading, error, unmatchedClasses };
}