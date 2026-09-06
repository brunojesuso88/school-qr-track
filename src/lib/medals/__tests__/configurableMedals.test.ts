/**
 * Medalhas configuráveis por escola: a configuração vira área de cálculo do
 * MESMO motor, e o histórico padrão continua valendo quando a escola ainda não
 * configurou nada.
 */
import { describe, expect, it } from 'vitest';
import { MEDAL_AREAS } from '../areas';
import { medalAreasFromDefinitions, MedalDefinitionRecord } from '../definitions';
import { computeAreaIra, computeMedals, MedalStudentInput } from '../compute';
import type { ClassGradesData } from '@/hooks/useStudentGrades';

const P1 = { id: 'p1', class_id: 'c1', label: '1º Período', normalized_label: '1º periodo', kind: 'period', sort_order: 1 };

const subj = (id: string, name: string, iraWeight: number) => ({
  id,
  class_id: 'c1',
  name,
  normalized_name: name.toLowerCase(),
  mapping_class_subject_id: null,
  weekly_classes: 0,
  include_in_ira: true,
  custom_ira_weight: null,
  ira_weight: iraWeight,
  classification: 'fgb',
  sort_order: 1,
});

const grade = (studentId: string, subjectId: string, value: number) => ({
  id: `${studentId}-${subjectId}`,
  student_id: studentId,
  grade_subject_id: subjectId,
  grade_period_id: 'p1',
  value,
  raw_text: null,
  confidence: null,
  flags: [] as string[],
  source: 'test',
});

const data = (over: Partial<ClassGradesData> = {}): ClassGradesData => ({
  subjects: [subj('mat', 'MATEMATICA', 4), subj('rob', 'ROBOTICA', 1)],
  periods: [P1],
  grades: [],
  settings: {
    id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1'],
    use_final_grade: false, scale_max: 10,
  },
  currentWeeklyClasses: {},
  matrixWeeklyByKey: {},
  ...over,
});

const medal = (over: Partial<MedalDefinitionRecord> = {}): MedalDefinitionRecord => ({
  id: 'm-tecnologia',
  name: 'Tecnologia',
  symbol: '🤖',
  description: null,
  active: true,
  sortOrder: 0,
  subjects: [{ matrixSubjectId: 'cms-rob', name: 'ROBOTICA', series: '1', matrixId: 'mx-a' }],
  ...over,
});

describe('medalhas configuradas pela escola', () => {
  it('converte a medalha em área de cálculo com símbolo e disciplinas', () => {
    const areas = medalAreasFromDefinitions([medal()]);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ id: 'm-tecnologia', label: 'Tecnologia', symbol: '🤖' });
    expect(areas[0].aliases).toEqual(['ROBOTICA']);
    expect(areas[0].title).toBe('Melhor aluno de Tecnologia');
  });

  it('medalha inativa ou sem disciplinas não entra na disputa', () => {
    expect(medalAreasFromDefinitions([medal({ active: false })])).toHaveLength(0);
    expect(medalAreasFromDefinitions([medal({ subjects: [] })])).toHaveLength(0);
  });

  it('só considera as disciplinas da medalha (nunca a turma inteira)', () => {
    const areas = medalAreasFromDefinitions([medal()]);
    const ira = computeAreaIra(
      data({ grades: [grade('ana', 'mat', 10), grade('ana', 'rob', 7)] }),
      'ana',
      areas[0],
    );
    expect(ira.subjects).toEqual(['ROBOTICA']);
    expect(ira.result.value).toBeCloseTo(7, 10);
  });

  it('premia o melhor da série com o símbolo configurado', () => {
    const students: MedalStudentInput[] = [
      { studentId: 'ana', series: '1', data: data({ grades: [grade('ana', 'rob', 9)] }) },
      { studentId: 'bia', series: '1', data: data({ grades: [grade('bia', 'rob', 6)] }) },
    ];
    const result = computeMedals(students, medalAreasFromDefinitions([medal()]));
    expect(Object.keys(result)).toEqual(['ana']);
    expect(result.ana[0]).toMatchObject({ areaId: 'm-tecnologia', symbol: '🤖', value: 9, shared: false });
    expect(result.bia).toBeUndefined();
  });

  it('sem configuração da escola, as áreas padrão continuam valendo', () => {
    expect(medalAreasFromDefinitions([]).length).toBe(0);
    expect(MEDAL_AREAS.length).toBeGreaterThan(0);
  });

  it('disciplinas de outra matriz/escola nunca entram: o vínculo é por ID de componente', () => {
    const areas = medalAreasFromDefinitions([medal({
      subjects: [{ matrixSubjectId: 'cms-outra-escola', name: 'DISCIPLINA DE OUTRA ESCOLA', series: '1', matrixId: 'mx-b' }],
    })]);
    const ira = computeAreaIra(data({ grades: [grade('ana', 'rob', 9)] }), 'ana', areas[0]);
    expect(ira.subjects).toEqual([]);
    expect(ira.hasData).toBe(false);
  });
});
