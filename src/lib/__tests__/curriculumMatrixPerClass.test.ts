/**
 * Regressão: duas turmas da MESMA série podem usar matrizes curriculares
 * diferentes, com cargas diferentes. IRA, medalhas, ranking e snapshots precisam
 * usar a carga da matriz de CADA turma — nunca um mapa escolar compartilhado.
 */
import { describe, expect, it } from 'vitest';
import type { ClassGradesData } from '@/hooks/useStudentGrades';
import { computeIraForStudent } from '@/hooks/useStudentGrades';
import { computeMedals } from '@/lib/medals/compute';
import {
  ClassMatrixRef, MatrixWeeklyScopedRow, buildMatrixWeeklyByClass,
} from '@/lib/curriculumMatrixWeekly';
import { mergeSubjectSeries } from '@/lib/curriculumMatrices';

const ORIGINAL = 'matrix-original';
const CUSTOM = 'matrix-custom';

const P1 = { id: 'p1', class_id: 'c1', label: '1º Período', normalized_label: '1º periodo', kind: 'period', sort_order: 1 };

const rows: MatrixWeeklyScopedRow[] = [
  { matrix_id: ORIGINAL, series: '1', weekly_classes: 4, name: 'LINGUA PORTUGUESA', aliases: ['Português'] },
  { matrix_id: ORIGINAL, series: '1', weekly_classes: 1, name: 'EDUCACAO FISICA', aliases: [] },
  { matrix_id: CUSTOM, series: '1', weekly_classes: 1, name: 'LINGUA PORTUGUESA', aliases: ['Português'] },
  { matrix_id: CUSTOM, series: '1', weekly_classes: 4, name: 'EDUCACAO FISICA', aliases: [] },
  { matrix_id: ORIGINAL, series: '2', weekly_classes: 2, name: 'LINGUA PORTUGUESA', aliases: [] },
];

const classes: ClassMatrixRef[] = [
  { id: 'turmaA', series: '1', curriculum_matrix_id: ORIGINAL },
  { id: 'turmaB', series: '1', curriculum_matrix_id: CUSTOM },
  { id: 'turmaLegado', series: '1', curriculum_matrix_id: null },
  { id: 'turmaSemSerie', series: null, curriculum_matrix_id: CUSTOM },
];

const subj = (id: string, name: string) => ({
  id, class_id: 'c1', name, normalized_name: name.toLowerCase(),
  mapping_class_subject_id: null, weekly_classes: null,
  include_in_ira: true, custom_ira_weight: null, sort_order: 1,
});

const grade = (subjectId: string, value: number) => ({
  id: `g-${subjectId}`, student_id: 'aluno', grade_subject_id: subjectId,
  grade_period_id: 'p1', value, raw_text: null, confidence: null,
  flags: [] as string[], source: 'test',
});

const classData = (matrixWeeklyByKey: Record<string, number>): ClassGradesData => ({
  subjects: [subj('pt', 'LINGUA PORTUGUESA'), subj('ef', 'EDUCACAO FISICA')],
  periods: [P1],
  grades: [grade('pt', 5), grade('ef', 10)],
  settings: {
    id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1'],
    use_final_grade: false, scale_max: 10,
  },
  currentWeeklyClasses: {},
  matrixWeeklyByKey,
});

describe('carga semanal por matriz da turma', () => {
  const byClass = buildMatrixWeeklyByClass(classes, rows, ORIGINAL);

  it('cada turma recebe a carga da sua própria matriz', () => {
    expect(byClass.get('turmaA')!['lingua portuguesa']).toBe(4);
    expect(byClass.get('turmaA')!['educacao fisica']).toBe(1);
    expect(byClass.get('turmaB')!['lingua portuguesa']).toBe(1);
    expect(byClass.get('turmaB')!['educacao fisica']).toBe(4);
  });

  it('turma legada sem matriz cai na Matriz Original, sem misturar matrizes', () => {
    expect(byClass.get('turmaLegado')).toEqual(byClass.get('turmaA'));
    expect(byClass.get('turmaLegado')!['educacao fisica']).toBe(1);
  });

  it('respeita a série: componente de outra série não vaza para a turma', () => {
    const only2 = buildMatrixWeeklyByClass(
      [{ id: 'x', series: '2', curriculum_matrix_id: ORIGINAL }], rows, ORIGINAL,
    );
    expect(only2.get('x')!['lingua portuguesa']).toBe(2);
    expect(only2.get('x')!['educacao fisica']).toBeUndefined();
  });

  it('turma sem série fica sem carga (nunca herda de outra turma)', () => {
    expect(byClass.get('turmaSemSerie')).toEqual({});
  });

  it('IRA do MESMO aluno difere conforme a matriz da turma', () => {
    const iraA = computeIraForStudent(classData(byClass.get('turmaA')!), 'aluno');
    const iraB = computeIraForStudent(classData(byClass.get('turmaB')!), 'aluno');
    // Turma A: Português peso 4 (nota 5) + EF peso 1 (nota 10) => 6,0
    expect(iraA.value).toBeCloseTo(6, 2);
    // Turma B: pesos invertidos => 9,0
    expect(iraB.value).toBeCloseTo(9, 2);
    expect(iraA.value).not.toBe(iraB.value);
  });

  it('medalhas/ranking também mudam com a matriz da turma', () => {
    const medalsA = computeMedals([
      { studentId: 'aluno', series: '1', data: classData(byClass.get('turmaA')!) },
      { studentId: 'rival', series: '1', data: classData(byClass.get('turmaB')!) },
    ]);
    const geralA = medalsA.get('aluno')?.find((m) => m.area === 'geral');
    const geralRival = medalsA.get('rival')?.find((m) => m.area === 'geral');
    // O aluno da matriz com pesos favoráveis (turma B) fica à frente.
    expect(geralRival?.position).toBe(1);
    expect(geralA?.position).toBe(2);
  });
});

describe('catálogo da escola: séries acumulativas', () => {
  it('mescla a nova série sem remover as anteriores e é idempotente', () => {
    expect(mergeSubjectSeries(['1'], '2')).toEqual(['1', '2']);
    expect(mergeSubjectSeries(['1', '2'], '2')).toEqual(['1', '2']);
    expect(mergeSubjectSeries(null, '3')).toEqual(['3']);
    expect(mergeSubjectSeries(['3', '1'], '1')).toEqual(['1', '3']);
  });
});
