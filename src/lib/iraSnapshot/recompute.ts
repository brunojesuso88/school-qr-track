/**
 * Recálculo EXPLÍCITO do IRA e das medalhas (botão "Atualizar IRA").
 *
 * Nada aqui roda automaticamente: a tela Alunos apenas lê `ira_snapshots`.
 * O motor de cálculo, períodos, pesos e regras de medalha são reutilizados sem
 * alteração; `student_grades` nunca é escrito.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  ClassGradesData, GradePeriodRow, GradeSubjectRow, IraSettingsRow, StudentGradeRow,
  computeIraForStudent, fetchGradesPaged,
} from '@/hooks/useStudentGrades';
import { computeMedals, MedalStudentInput } from '@/lib/medals/compute';
import { parseSeriesValue } from '@/lib/series';
import { isPeriodKind, periodRank } from '@/lib/gradePageLocal/normalize';
import { fetchMatrixWeeklyByClass } from '@/lib/curriculumMatrixWeekly';
import { IraSnapshotRow, SnapshotBuildInput, buildSnapshotRows, isDropout } from './core';
import { NO_ACTIVE_SCHOOL_MESSAGE, assertActiveSchool } from '@/lib/schools/scope';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export interface RecomputeResult {
  /** Turmas efetivamente recalculadas (a série inteira, para o ranking de medalhas). */
  classIds: string[];
  students: number;
  eligible: number;
  dropouts: number;
  medals: number;
}

/** Marca o IRA de uma turma como desatualizado (ex.: após importar boletim). */
export async function markIraStale(
  classId: string,
  reason: string,
  schoolId: string | null | undefined,
): Promise<void> {
  const { error } = await supabase
    .from('ira_staleness')
    .upsert(
      {
        school_id: assertActiveSchool(schoolId),
        class_id: classId,
        stale: true,
        reason,
        marked_at: new Date().toISOString(),
      } as never,
      { onConflict: 'class_id' },
    );
  // Falhar silenciosamente aqui esconderia IRA desatualizado: propagar o erro.
  if (error) throw error;
}

/**
 * Recalcula e PERSISTE IRA + medalhas para o escopo das turmas informadas.
 * O escopo é expandido para todas as turmas da mesma série, pois a disputa das
 * medalhas é por série.
 */
export async function recomputeIraScope(
  classNames: string[],
  computedBy: string | null,
  schoolId: string,
): Promise<RecomputeResult> {
  const empty: RecomputeResult = { classIds: [], students: 0, eligible: 0, dropouts: 0, medals: 0 };
  if (classNames.length === 0) return empty;
  if (!schoolId) throw new Error(NO_ACTIVE_SCHOOL_MESSAGE);

  // Todo o escopo (turmas, alunos, notas, medalhas) é restrito à escola ativa:
  // a disputa por série NUNCA cruza escolas.
  const { data: classRows, error: classErr } = await supabase
    .from('classes')
    .select('id, name, series, curriculum_matrix_id')
    .eq('school_id', schoolId);
  if (classErr) throw classErr;
  const all = (classRows || []) as {
    id: string; name: string; series: string | null; curriculum_matrix_id: string | null;
  }[];

  const requestedNorm = new Set(classNames.map(norm));
  const requested = all.filter((c) => requestedNorm.has(norm(c.name)));
  const seriesInScope = new Set(
    requested.map((c) => parseSeriesValue(c.series)).filter(Boolean) as string[],
  );

  // Turmas do escopo: as solicitadas + todas as turmas das séries envolvidas.
  const scopeClasses = all.filter((c) => {
    if (requestedNorm.has(norm(c.name))) return true;
    const s = parseSeriesValue(c.series);
    return s != null && seriesInScope.has(s);
  });
  if (scopeClasses.length === 0) return empty;

  const classIds = scopeClasses.map((c) => c.id);
  const classById = new Map(scopeClasses.map((c) => [c.id, c]));
  const classIdByNormName = new Map(scopeClasses.map((c) => [norm(c.name), c.id]));

  const [studentsRes, subjRes, perRes, settingsRes] = await Promise.all([
    supabase.from('students').select('id, class, status')
      .eq('school_id', schoolId).in('class', scopeClasses.map((c) => c.name)),
    supabase.from('grade_subjects').select('*').eq('school_id', schoolId)
      .in('class_id', classIds).eq('legacy_excluded', false).order('sort_order'),
    supabase.from('grade_periods').select('*').eq('school_id', schoolId)
      .in('class_id', classIds).order('sort_order'),
    supabase.from('ira_settings').select('*').eq('school_id', schoolId).in('class_id', classIds),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (subjRes.error) throw subjRes.error;
  if (perRes.error) throw perRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const studentRows = (studentsRes.data || []) as { id: string; class: string; status: string | null }[];
  const subjects = (subjRes.data || []) as unknown as GradeSubjectRow[];
  const periods = ((perRes.data || []) as unknown as GradePeriodRow[])
    .filter((p) => isPeriodKind(p.kind))
    .sort((a, b) => periodRank(a.label) - periodRank(b.label) || a.sort_order - b.sort_order);
  const settings = (settingsRes.data || []) as unknown as IraSettingsRow[];

  const grades: StudentGradeRow[] = await fetchGradesPaged(subjects.map((s) => s.id), undefined, schoolId);

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

  // Snapshots e medalhas são persistidos: a carga vem da matriz de CADA turma.
  const weeklyByClass = await fetchMatrixWeeklyByClass(
    scopeClasses.map((c) => ({
      id: c.id, series: parseSeriesValue(c.series), curriculum_matrix_id: c.curriculum_matrix_id,
    })),
    schoolId,
  );

  const dataByClass = new Map<string, ClassGradesData>();
  classIds.forEach((classId) => {
    const classSubjectIds = new Set(subjects.filter((s) => s.class_id === classId).map((s) => s.id));
    dataByClass.set(classId, {
      subjects: subjects.filter((s) => s.class_id === classId),
      periods: periods.filter((p) => p.class_id === classId),
      grades: grades.filter((g) => classSubjectIds.has(g.grade_subject_id)),
      settings: settings.find((s) => s.class_id === classId) ?? null,
      currentWeeklyClasses,
      matrixWeeklyByKey: weeklyByClass.get(classId) ?? {},
    });
  });

  // Desistentes ficam FORA do cálculo e da disputa por medalhas.
  const medalInputs: MedalStudentInput[] = [];
  studentRows.forEach((s) => {
    if (isDropout(s.status)) return;
    const classId = classIdByNormName.get(norm(s.class));
    const data = classId ? dataByClass.get(classId) : undefined;
    if (!classId || !data) return;
    medalInputs.push({
      studentId: s.id,
      series: parseSeriesValue(classById.get(classId)?.series ?? null),
      data,
    });
  });
  const medalsByStudent = computeMedals(medalInputs);

  const computedAt = new Date().toISOString();
  const inputs: SnapshotBuildInput[] = studentRows.map((s) => {
    const classId = classIdByNormName.get(norm(s.class)) ?? null;
    const klass = classId ? classById.get(classId) : undefined;
    const data = classId ? dataByClass.get(classId) : undefined;
    const dropout = isDropout(s.status);
    return {
      studentId: s.id,
      status: s.status,
      classId,
      className: klass?.name ?? s.class,
      series: parseSeriesValue(klass?.series ?? null),
      ira: !dropout && data ? computeIraForStudent(data, s.id) : null,
      medals: dropout ? [] : medalsByStudent[s.id] ?? [],
    };
  });

  const rows: IraSnapshotRow[] = buildSnapshotRows(inputs, computedBy, computedAt)
    .map((r) => ({ ...r, school_id: schoolId })) as IraSnapshotRow[];

  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { error } = await supabase
      .from('ira_snapshots')
      .upsert(chunk as never, { onConflict: 'student_id' });
    if (error) throw error;
  }

  const stalenessRows = classIds.map((classId) => ({
    school_id: schoolId,
    class_id: classId,
    stale: false,
    reason: null,
    marked_at: computedAt,
    last_computed_at: computedAt,
  }));
  const { error: stErr } = await supabase
    .from('ira_staleness')
    .upsert(stalenessRows as never, { onConflict: 'class_id' });
  if (stErr) throw stErr;

  const eligible = rows.filter((r) => r.eligible).length;
  return {
    classIds,
    students: rows.length,
    eligible,
    dropouts: rows.length - eligible,
    medals: rows.reduce((acc, r) => acc + r.medals.length, 0),
  };
}
