/**
 * IRA ARITMÉTICO (Matriz Integral) ponta a ponta nos helpers de cálculo.
 *
 * Regressão do bloqueador: turmas na Matriz Integral têm carga semanal NULA;
 * se o cálculo cair no modo ponderado padrão, nenhuma disciplina recebe peso e
 * o IRA fica indisponível. O modo vem SEMPRE da matriz da turma.
 */
import { describe, expect, it } from 'vitest';
import type { ClassGradesData } from '@/hooks/useStudentGrades';
import { computeIraForStudent } from '@/hooks/useStudentGrades';
import { buildIraModeByClass } from '@/lib/iraModes';
import { buildSnapshotRows } from '@/lib/iraSnapshot/core';

const P1 = { id: 'p1', class_id: 'c1', label: '1º Período', normalized_label: '1º periodo', kind: 'period', sort_order: 1 };

const subj = (id: string, name: string, weekly: number | null, slot = 1) => ({
  id,
  class_id: 'c1',
  name,
  normalized_name: name.toLowerCase(),
  mapping_class_subject_id: null,
  weekly_classes: weekly,
  include_in_ira: true,
  custom_ira_weight: null,
  sort_order: slot,
});

const grade = (subjectId: string, value: number | null) => ({
  id: `g-${subjectId}`,
  student_id: 'aluno',
  grade_subject_id: subjectId,
  grade_period_id: 'p1',
  value,
  raw_text: null,
  confidence: null,
  flags: [] as string[],
  source: 'test',
});

const SETTINGS = {
  id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1'],
  use_final_grade: false, scale_max: 10,
};

const integralData = (over: Partial<ClassGradesData> = {}): ClassGradesData => ({
  subjects: [
    subj('a', 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES', null),
    subj('b', 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS', null),
    subj('c', 'CRIATIVIDADE E INOVACAO NO EMPREENDEDORISMO', null),
  ],
  periods: [P1],
  grades: [grade('a', 8), grade('b', 6), grade('c', 10)],
  settings: SETTINGS,
  currentWeeklyClasses: {},
  matrixWeeklyByKey: {},
  iraCalculationMode: 'arithmetic',
  ...over,
});

describe('IRA aritmético com carga semanal nula', () => {
  it('notas 8/6/10 sem carga produzem 8,00', () => {
    const ira = computeIraForStudent(integralData(), 'aluno');
    expect(ira.mode).toBe('arithmetic');
    expect(ira.status).toBe('ok');
    expect(ira.value).toBeCloseTo(8, 10);
    expect(ira.totalWeight).toBe(3);
    expect(ira.lines.every((l) => l.weight === 1 && l.weightSource === 'arithmetic')).toBe(true);
  });

  it('sem o modo da matriz o cálculo ponderado não encontra peso (bug corrigido)', () => {
    const ira = computeIraForStudent(integralData({ iraCalculationMode: 'weighted_weekly' }), 'aluno');
    expect(ira.status).toBe('no_grades');
    expect(ira.value).toBeNull();
  });

  it('modo por turma vem do registro da matriz, nunca do nome', () => {
    const modes = buildIraModeByClass(
      [
        { id: 'turma-integral', curriculum_matrix_id: 'm-integral' },
        { id: 'turma-original', curriculum_matrix_id: 'm-original' },
        { id: 'turma-sem-matriz', curriculum_matrix_id: null },
      ],
      { 'm-integral': 'arithmetic', 'm-original': 'weighted_weekly' },
    );
    expect(modes.get('turma-integral')).toBe('arithmetic');
    expect(modes.get('turma-original')).toBe('weighted_weekly');
    expect(modes.get('turma-sem-matriz')).toBe('weighted_weekly');
  });

  it('snapshot/recompute aplica o modo por TURMA (aritmético x ponderado)', () => {
    const modes = buildIraModeByClass(
      [{ id: 'cIntegral', curriculum_matrix_id: 'm-integral' }, { id: 'cRegular', curriculum_matrix_id: 'm-original' }],
      { 'm-integral': 'arithmetic', 'm-original': 'weighted_weekly' },
    );
    const dataByClass = new Map<string, ClassGradesData>([
      ['cIntegral', integralData({ iraCalculationMode: modes.get('cIntegral') })],
      ['cRegular', {
        ...integralData({ iraCalculationMode: modes.get('cRegular') }),
        subjects: [subj('a', 'MATEMATICA', 4), subj('b', 'FILOSOFIA', 1)],
        grades: [grade('a', 8), grade('b', 3)],
      }],
    ]);

    const rows = buildSnapshotRows([
      {
        studentId: 'i1', status: 'active', classId: 'cIntegral', className: 'EPT 1', series: '1',
        ira: computeIraForStudent(dataByClass.get('cIntegral')!, 'aluno'), medals: [],
      },
      {
        studentId: 'r1', status: 'active', classId: 'cRegular', className: '1º A', series: '1',
        ira: computeIraForStudent(dataByClass.get('cRegular')!, 'aluno'), medals: [],
      },
    ], null, '2026-01-01T00:00:00.000Z');

    expect(rows[0].ira_value).toBeCloseTo(8, 10);
    // Ponderado: (8×4 + 3×1) / 5 = 7,00
    expect(rows[1].ira_value).toBeCloseTo(7, 10);
  });

  it('slots duplicados contam separadamente: 8 e 6 => 7,00', () => {
    const data = integralData({
      subjects: [
        subj('s1', 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS', null, 1),
        subj('s2', 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS', null, 2),
      ],
      grades: [grade('s1', 8), grade('s2', 6)],
    });
    const ira = computeIraForStudent(data, 'aluno');
    expect(ira.lines).toHaveLength(2);
    expect(ira.totalWeight).toBe(2);
    expect(ira.value).toBeCloseTo(7, 10);
  });
});
