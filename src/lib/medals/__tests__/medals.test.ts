import { describe, expect, it } from 'vitest';
import { MEDAL_AREAS, areasForSubject, subjectBelongsToArea } from '../areas';
import { computeAreaIra, computeMedals, MedalStudentInput } from '../compute';
import type { ClassGradesData } from '@/hooks/useStudentGrades';

const P1 = { id: 'p1', class_id: 'c1', label: '1º Período', normalized_label: '1º periodo', kind: 'period', sort_order: 1 };
const P2 = { id: 'p2', class_id: 'c1', label: '2º Período', normalized_label: '2º periodo', kind: 'period', sort_order: 2 };
const FINAL = { id: 'pf', class_id: 'c1', label: 'Final', normalized_label: 'final', kind: 'final', sort_order: 9 };

const subj = (id: string, name: string, weekly: number | null, extra: Partial<ClassGradesData['subjects'][number]> = {}) => ({
  id,
  class_id: 'c1',
  name,
  normalized_name: name.toLowerCase(),
  mapping_class_subject_id: null,
  weekly_classes: weekly,
  include_in_ira: true,
  custom_ira_weight: null,
  sort_order: 1,
  ...extra,
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

function makeData(over: Partial<ClassGradesData> = {}): ClassGradesData {
  return {
    subjects: [],
    periods: [P1, P2, FINAL],
    grades: [],
    settings: {
      id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1'],
      use_final_grade: false, scale_max: 10,
    },
    currentWeeklyClasses: {},
    ...over,
  };
}

describe('áreas das medalhas', () => {
  it('agrupa as 5 áreas esperadas', () => {
    expect(MEDAL_AREAS.map((a) => a.id)).toEqual([
      'linguagens', 'matematica', 'humanas', 'natureza', 'diversificada',
    ]);
  });

  it('normaliza acentos e caixa nos aliases', () => {
    expect(subjectBelongsToArea('LINGUA PORTUGUESA', 'linguagens')).toBe(true);
    expect(subjectBelongsToArea('educação física', 'linguagens')).toBe(true);
    expect(subjectBelongsToArea('Matemática', 'matematica')).toBe(true);
    expect(subjectBelongsToArea('letramento em matematica', 'matematica')).toBe(true);
    expect(subjectBelongsToArea('sociologia', 'humanas')).toBe(true);
    expect(subjectBelongsToArea('QUÍMICA', 'natureza')).toBe(true);
    expect(subjectBelongsToArea('identidade e protagonismo', 'diversificada')).toBe(true);
    expect(subjectBelongsToArea('Projeto de Vida', 'diversificada')).toBe(false);
  });

  it('LETRAMENTO EM LÍNGUA PORTUGUESA pertence a Linguagens E à Parte Diversificada', () => {
    expect(areasForSubject('LETRAMENTO EM LÍNGUA PORTUGUESA').sort()).toEqual(
      ['diversificada', 'linguagens'],
    );
  });
});

describe('IRA por área', () => {
  it('calcula média ponderada apenas das disciplinas da área', () => {
    const data = makeData({
      subjects: [
        subj('s-port', 'Língua Portuguesa', 2),
        subj('s-mat', 'Matemática', 4),
      ],
      grades: [
        grade('a1', 's-port', 'p1', 10),
        grade('a1', 's-mat', 'p1', 5),
      ],
    });
    expect(computeAreaIra(data, 'a1', 'linguagens').result.value).toBeCloseTo(10);
    expect(computeAreaIra(data, 'a1', 'matematica').result.value).toBeCloseTo(5);
  });

  it('média entre múltiplos períodos e nota ausente contando como 0', () => {
    const data = makeData({
      settings: {
        id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1', 'p2'],
        use_final_grade: false, scale_max: 10,
      },
      subjects: [subj('s-fis', 'Física', 2)],
      grades: [grade('a1', 's-fis', 'p1', 10)],
    });
    // (10 + 0) / 2 = 5
    expect(computeAreaIra(data, 'a1', 'natureza').result.value).toBeCloseTo(5);
  });

  it('nota 0 explícita equivale a ausente no cálculo, mas conta como dado existente', () => {
    const zero = makeData({ subjects: [subj('s-bio', 'Biologia', 2)], grades: [grade('a1', 's-bio', 'p1', 0)] });
    const missing = makeData({ subjects: [subj('s-bio', 'Biologia', 2)] });
    expect(computeAreaIra(zero, 'a1', 'natureza').result.value).toBe(0);
    expect(computeAreaIra(zero, 'a1', 'natureza').hasData).toBe(true);
    expect(computeAreaIra(missing, 'a1', 'natureza').hasData).toBe(false);
  });

  it('não usa períodos finais nem disciplinas fora do IRA', () => {
    const data = makeData({
      subjects: [subj('s-geo', 'Geografia', 2, { include_in_ira: false })],
      grades: [grade('a1', 's-geo', 'p1', 10), grade('a1', 's-geo', 'pf', 10)],
    });
    expect(computeAreaIra(data, 'a1', 'humanas').hasData).toBe(false);
  });

  it('área sem disciplinas na turma não tem dados', () => {
    const data = makeData({ subjects: [subj('s-port', 'Português', 2)], grades: [grade('a1', 's-port', 'p1', 9)] });
    expect(computeAreaIra(data, 'a1', 'natureza').hasData).toBe(false);
  });
});

describe('medalhas por série', () => {
  const dataFor = (studentGrades: ReturnType<typeof grade>[]) =>
    makeData({ subjects: [subj('s-quim', 'Química', 2)], grades: studentGrades });

  it('premia o melhor da série, comparando turmas diferentes', () => {
    const inputs: MedalStudentInput[] = [
      { studentId: 'a1', series: '1', data: dataFor([grade('a1', 's-quim', 'p1', 7)]) },
      { studentId: 'b1', series: '1', data: dataFor([grade('b1', 's-quim', 'p1', 9)]) },
      { studentId: 'c1', series: '2', data: dataFor([grade('c1', 's-quim', 'p1', 6)]) },
    ];
    const medals = computeMedals(inputs);
    expect(medals.b1?.map((m) => m.areaId)).toEqual(['natureza']);
    expect(medals.b1?.[0].shared).toBe(false);
    expect(medals.a1).toBeUndefined();
    // Série 2 tem seu próprio vencedor, mesmo com IRA menor
    expect(medals.c1?.[0].series).toBe('2');
  });

  it('empate exato concede a medalha a todos', () => {
    const medals = computeMedals([
      { studentId: 'a1', series: '3', data: dataFor([grade('a1', 's-quim', 'p1', 8)]) },
      { studentId: 'b1', series: '3', data: dataFor([grade('b1', 's-quim', 'p1', 8)]) },
    ]);
    expect(medals.a1?.[0].shared).toBe(true);
    expect(medals.b1?.[0].shared).toBe(true);
  });

  it('série nula não participa', () => {
    const medals = computeMedals([
      { studentId: 'a1', series: null, data: dataFor([grade('a1', 's-quim', 'p1', 10)]) },
    ]);
    expect(medals).toEqual({});
  });

  it('área sem dados não concede medalha', () => {
    const medals = computeMedals([
      { studentId: 'a1', series: '1', data: makeData({ subjects: [subj('s-quim', 'Química', 2)] }) },
    ]);
    expect(medals).toEqual({});
  });

  it('inclui rótulo e disciplinas consideradas', () => {
    const medals = computeMedals([
      { studentId: 'a1', series: '2', data: dataFor([grade('a1', 's-quim', 'p1', 8)]) },
    ]);
    expect(medals.a1[0].seriesLabel).toContain('2º ano');
    expect(medals.a1[0].subjects).toEqual(['Química']);
    expect(medals.a1[0].title).toBe('Melhor aluno de Natureza');
  });
});
