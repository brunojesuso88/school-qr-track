/**
 * Cálculo determinístico das medalhas por série.
 *
 * Reutiliza o MESMO motor do IRA (`calculateIraMultiPeriod`) apenas restringindo
 * o conjunto de disciplinas à área. Não altera o IRA global nem persiste nada.
 */
import { calculateIraMultiPeriod, IraResult } from '@/lib/ira';
import {
  ClassGradesData,
  buildIraInputs,
  resolveIraPeriods,
  toPeriodRefs,
} from '@/hooks/useStudentGrades';
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';
import { MEDAL_AREAS, MedalAreaId, subjectBelongsToArea } from './areas';
import { parseSeriesValue, HighSchoolSeries, classSeriesLabel } from '@/lib/series';

export interface AreaIra {
  result: IraResult;
  /** Disciplinas da área efetivamente consideradas (nomes reais da turma). */
  subjects: string[];
  /** `true` quando existe pelo menos uma nota lançada em disciplina elegível. */
  hasData: boolean;
}

/** IRA de uma área para um aluno (mesmas regras-base do IRA global). */
export function computeAreaIra(
  data: ClassGradesData,
  studentId: string,
  areaId: MedalAreaId,
): AreaIra {
  // Matching determinístico por identidade canônica + deduplicação de
  // aliases/duplicatas históricas (a mesma disciplina nunca pesa duas vezes).
  const seen = new Set<string>();
  const areaSubjects = data.subjects
    .filter((s) => subjectBelongsToArea(s.name, areaId))
    .filter((s) => {
      const key = canonicalSubjectKey(s.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const scoped: ClassGradesData = { ...data, subjects: areaSubjects };
  const periods = resolveIraPeriods(data);
  const result = calculateIraMultiPeriod(
    buildIraInputs(scoped, studentId, periods.map((p) => p.id)),
    toPeriodRefs(periods),
  );
  const hasData =
    result.status === 'ok' &&
    result.lines.some((l) => l.eligible && l.periodValues.some((v) => !v.missing));
  // Só reportamos as disciplinas que realmente entraram no cálculo (com peso válido),
  // evitando exibir na medalha componentes que foram descartados.
  const counted = result.lines.filter((l) => l.eligible && l.weight != null).map((l) => l.name);
  return { result, subjects: counted, hasData };
}

export interface MedalStudentInput {
  studentId: string;
  /** Série da turma do aluno (valor persistido ou rótulo legado). */
  series: string | null | undefined;
  /** Notas/configuração da TURMA do aluno. */
  data: ClassGradesData;
}

export interface StudentMedal {
  areaId: MedalAreaId;
  title: string;
  series: HighSchoolSeries;
  seriesLabel: string;
  /** IRA da área do aluno. */
  value: number;
  /** Disciplinas consideradas no cálculo. */
  subjects: string[];
  /** `true` quando há mais de um aluno com o mesmo maior IRA da área. */
  shared: boolean;
}

/**
 * Medalhas de todos os alunos informados. Universo da disputa = SÉRIE
 * (todas as turmas da mesma série). Alunos sem série não participam.
 */
export function computeMedals(students: MedalStudentInput[]): Record<string, StudentMedal[]> {
  const medals: Record<string, StudentMedal[]> = {};
  const bySeries = new Map<HighSchoolSeries, MedalStudentInput[]>();
  students.forEach((s) => {
    const series = parseSeriesValue(s.series ?? null);
    if (!series) return;
    bySeries.set(series, [...(bySeries.get(series) || []), s]);
  });

  bySeries.forEach((group, series) => {
    MEDAL_AREAS.forEach((area) => {
      const scored = group
        .map((s) => ({ student: s, area: computeAreaIra(s.data, s.studentId, area.id) }))
        .filter((r) => r.area.hasData && r.area.result.value != null);
      if (scored.length === 0) return;
      const best = Math.max(...scored.map((r) => r.area.result.value as number));
      const winners = scored.filter((r) => (r.area.result.value as number) === best);
      winners.forEach((w) => {
        medals[w.student.studentId] = [
          ...(medals[w.student.studentId] || []),
          {
            areaId: area.id,
            title: area.title,
            series,
            seriesLabel: classSeriesLabel(series),
            value: best,
            subjects: w.area.subjects,
            shared: winners.length > 1,
          },
        ];
      });
    });
  });

  return medals;
}
