/**
 * Regressão da causa raiz da medalha de Linguagens do 1º ano:
 * disciplinas SEM vínculo de mapeamento ficavam com `weekly_classes` nulo,
 * perdiam o peso e desapareciam silenciosamente do IRA da área — a medalha
 * passava a refletir apenas Educação Física, divergindo da aba Notas.
 */
import { describe, expect, it } from 'vitest';
import type { ClassGradesData } from '@/hooks/useStudentGrades';
import { buildIraInputs, resolveIraPeriods, toPeriodRefs } from '@/hooks/useStudentGrades';
import { calculateIraMultiPeriod } from '@/lib/ira';
import { buildMatrixWeeklyByKey } from '@/lib/curriculumMatrixWeekly';
import { computeAreaIra, computeMedals } from '../compute';

const P1 = { id: 'p1', class_id: 'c1', label: '1º Período', normalized_label: '1º periodo', kind: 'period', sort_order: 1 };
const P2 = { id: 'p2', class_id: 'c1', label: '2º Período', normalized_label: '2º periodo', kind: 'period', sort_order: 2 };

const subj = (id: string, name: string, weekly: number | null) => ({
  id,
  class_id: 'c1',
  name,
  normalized_name: name.toLowerCase(),
  mapping_class_subject_id: null,
  weekly_classes: weekly,
  include_in_ira: true,
  custom_ira_weight: null,
  sort_order: 1,
});

const grade = (studentId: string, subjectId: string, periodId: string, value: number | null) => ({
  id: `${studentId}-${subjectId}-${periodId}`,
  student_id: studentId,
  grade_subject_id: subjectId,
  grade_period_id: periodId,
  value,
  raw_text: null,
  confidence: null,
  flags: [] as string[],
  source: 'test',
});

/** Matriz oficial da 1ª série (recorte de Linguagens). */
const MATRIX = buildMatrixWeeklyByKey([
  { series: '1', weekly_classes: 4, name: 'LINGUA PORTUGUESA', aliases: ['Língua Portuguesa', 'Português'] },
  { series: '1', weekly_classes: 1, name: 'LETRAMENTO EM LINGUA PORTUGUESA', aliases: [] },
  { series: '1', weekly_classes: 1, name: 'EDUCACAO FISICA', aliases: ['Educação Física'] },
]);

function joaoData(over: Partial<ClassGradesData> = {}): ClassGradesData {
  return {
    subjects: [
      subj('pt', 'LINGUA PORTUGUESA', null),
      subj('let', 'LETRAMENTO EM LINGUA PORTUGUESA', null),
      subj('ef', 'EDUCACAO FISICA', 1),
    ],
    periods: [P1, P2],
    grades: [
      grade('joao', 'pt', 'p1', 5.67), grade('joao', 'pt', 'p2', 7),
      grade('joao', 'let', 'p1', 6.5),
      grade('joao', 'ef', 'p1', 10), grade('joao', 'ef', 'p2', 10),
    ],
    settings: {
      id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1', 'p2'],
      use_final_grade: false, scale_max: 10,
    },
    currentWeeklyClasses: {},
    matrixWeeklyByKey: MATRIX,
    ...over,
  };
}

describe('carga semanal oficial da matriz como fonte de verdade', () => {
  it('mapeia nome e aliases (acentos/caixa) para a mesma carga', () => {
    expect(MATRIX['lingua portuguesa']).toBe(4);
    expect(MATRIX['portugues']).toBe(4);
    expect(MATRIX['educacao fisica']).toBe(1);
  });

  it('sem a matriz, Português e Letramento ficam sem peso (bug original)', () => {
    const area = computeAreaIra(joaoData({ matrixWeeklyByKey: {} }), 'joao', 'linguagens');
    expect(area.result.value).toBe(10);
    expect(area.subjects).toEqual(['EDUCACAO FISICA']);
  });

  it('com a matriz, a medalha bate com as notas da aba Notas', () => {
    const data = joaoData();
    const area = computeAreaIra(data, 'joao', 'linguagens');
    // PT (5,67+7)/2=6,335 × 4 | LET (6,50+0)/2=3,25 × 1 | EF 10 × 1 => /6
    const expected = (6.335 * 4 + 3.25 + 10) / 6;
    expect(area.result.value).toBeCloseTo(expected, 6);
    expect(area.subjects.sort()).toEqual(
      ['EDUCACAO FISICA', 'LETRAMENTO EM LINGUA PORTUGUESA', 'LINGUA PORTUGUESA'],
    );
  });

  it('usa exatamente as mesmas notas/períodos/pesos do motor do IRA', () => {
    const data = joaoData();
    const periods = resolveIraPeriods(data);
    const scoped: ClassGradesData = {
      ...data,
      subjects: data.subjects.filter((s) => ['pt', 'let', 'ef'].includes(s.id)),
    };
    const direct = calculateIraMultiPeriod(
      buildIraInputs(scoped, 'joao', periods.map((p) => p.id)),
      toPeriodRefs(periods),
    );
    expect(computeAreaIra(data, 'joao', 'linguagens').result.value).toBeCloseTo(direct.value as number, 10);
  });

  it('não conta a mesma disciplina duas vezes quando há duplicata/alias histórico', () => {
    const data = joaoData({
      subjects: [
        subj('pt', 'LINGUA PORTUGUESA', null),
        subj('pt2', 'Língua Portuguesa', null),
        subj('ef', 'EDUCACAO FISICA', 1),
      ],
      grades: [
        grade('joao', 'pt', 'p1', 5.67), grade('joao', 'pt', 'p2', 7),
        grade('joao', 'pt2', 'p1', 5.67), grade('joao', 'pt2', 'p2', 7),
        grade('joao', 'ef', 'p1', 10), grade('joao', 'ef', 'p2', 10),
      ],
    });
    const area = computeAreaIra(data, 'joao', 'linguagens');
    expect(area.subjects).toEqual(['LINGUA PORTUGUESA', 'EDUCACAO FISICA']);
    expect(area.result.value).toBeCloseTo((6.335 * 4 + 10) / 5, 6);
  });

  it('Letramento em Língua Portuguesa continua na Parte Diversificada', () => {
    const data = joaoData();
    const diversificada = computeAreaIra(data, 'joao', 'diversificada');
    expect(diversificada.subjects).toContain('LETRAMENTO EM LINGUA PORTUGUESA');
  });

  it('ranking por série usa o valor corrigido', () => {
    const rival: ClassGradesData = joaoData({
      grades: [
        grade('ana', 'pt', 'p1', 8), grade('ana', 'pt', 'p2', 8),
        grade('ana', 'let', 'p1', 8), grade('ana', 'let', 'p2', 8),
        grade('ana', 'ef', 'p1', 8), grade('ana', 'ef', 'p2', 8),
      ],
    });
    const medals = computeMedals([
      { studentId: 'joao', series: '1', data: joaoData() },
      { studentId: 'ana', series: '1', data: rival },
    ]);
    expect(medals['ana']?.some((m) => m.areaId === 'linguagens')).toBe(true);
    expect(medals['joao']?.some((m) => m.areaId === 'linguagens') ?? false).toBe(false);
  });
});
