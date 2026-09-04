/**
 * CARGA SEMANAL 0 (Matriz Integral) NO ALGORITMO ÚNICO DO IRA.
 *
 * A Matriz Integral usa EXATAMENTE o mesmo cálculo da Matriz Original. A única
 * diferença é a origem: componentes sem carga informada nascem com
 * `weekly_classes = 0`, que significa "não informada":
 *  - não entra no denominador (nunca NaN/Infinity);
 *  - quando a soma dos pesos é 0 o resultado é determinístico:
 *    `value = null` + `status = 'no_grades'` (comportamento histórico preservado);
 *  - ao informar 1/2/4 a disciplina passa a pesar como em qualquer matriz.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateIraMultiPeriod, hasWeeklyLoad, resolveWeight, weightForWeeklyClasses,
} from '@/lib/ira';
import type { ClassGradesData } from '@/hooks/useStudentGrades';
import { computeIraForStudent } from '@/hooks/useStudentGrades';
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

const data = (over: Partial<ClassGradesData> = {}): ClassGradesData => ({
  subjects: [
    subj('a', 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES', 0),
    subj('b', 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS', 0),
  ],
  periods: [P1],
  grades: [grade('a', 8), grade('b', 6)],
  settings: SETTINGS,
  currentWeeklyClasses: {},
  matrixWeeklyByKey: {},
  ...over,
});

describe('carga semanal 0 = não informada', () => {
  it('0, null e valores inválidos não geram peso automático', () => {
    expect(hasWeeklyLoad(0)).toBe(false);
    expect(hasWeeklyLoad(null)).toBe(false);
    expect(hasWeeklyLoad(Number.NaN)).toBe(false);
    expect(hasWeeklyLoad(2)).toBe(true);
    expect(weightForWeeklyClasses(0)).toBeNull();
    expect(resolveWeight({ weeklyClasses: 0, customWeight: null })).toEqual({ weight: null, source: 'none' });
  });

  it('soma de pesos 0 => resultado determinístico (null + no_grades), sem NaN/Infinity', () => {
    const ira = computeIraForStudent(data(), 'aluno');
    expect(ira.status).toBe('no_grades');
    expect(ira.value).toBeNull();
    expect(ira.totalWeight).toBe(0);
    expect(Number.isNaN(ira.totalProduct)).toBe(false);
    expect(ira.lines.every((l) => l.weight === null && l.weightSource === 'none')).toBe(true);
    expect(ira.lines[0].reason).toContain('Carga semanal não informada');
  });

  it('carga 0 não aumenta o denominador de quem tem carga válida', () => {
    // 8 com carga 4 + 6 com carga 0 => IRA = 8,00 (o 6 fica de fora).
    const ira = computeIraForStudent(
      data({ subjects: [subj('a', 'MATEMATICA', 4), subj('b', 'PROJETO DE VIDA', 0)] }),
      'aluno',
    );
    expect(ira.status).toBe('ok');
    expect(ira.totalWeight).toBe(4);
    expect(ira.value).toBeCloseTo(8, 10);
  });

  it('ao informar a carga (0 -> 4) o peso passa a valer, igual à Matriz Original', () => {
    const antes = computeIraForStudent(data(), 'aluno');
    expect(antes.value).toBeNull();
    const depois = computeIraForStudent(
      data({
        subjects: [
          subj('a', 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES', 4),
          subj('b', 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS', 1),
        ],
      }),
      'aluno',
    );
    // (8×4 + 6×1) / 5 = 7,60
    expect(depois.value).toBeCloseTo(7.6, 10);
  });

  it('peso personalizado continua resgatando componentes de carga 0', () => {
    const ira = computeIraForStudent(
      data({
        subjects: [
          { ...subj('a', 'A', 0), custom_ira_weight: 2 },
          { ...subj('b', 'B', 0), custom_ira_weight: 2 },
        ],
      }),
      'aluno',
    );
    expect(ira.value).toBeCloseTo(7, 10);
  });

  it('nota ausente continua diferente de 0,00 no boletim (regra da Matriz Original)', () => {
    const ira = computeIraForStudent(
      data({ subjects: [subj('a', 'MATEMATICA', 4)], grades: [grade('a', null)] }),
      'aluno',
    );
    expect(ira.lines[0].periodValues[0].value).toBeNull();
    expect(ira.lines[0].periodValues[0].usedValue).toBe(0);
    expect(ira.value).toBeCloseTo(0, 10);
  });

  it('regressão da Matriz Original: 8 (carga 4) + 3 (carga 1) => 7,00', () => {
    const ira = calculateIraMultiPeriod(
      [
        { subjectId: 'a', name: 'MATEMATICA', weeklyClasses: 4, includeInIra: true, customWeight: null, valuesByPeriod: { p1: 8 } },
        { subjectId: 'b', name: 'FILOSOFIA', weeklyClasses: 1, includeInIra: true, customWeight: null, valuesByPeriod: { p1: 3 } },
      ],
      [{ id: 'p1', label: '1º Período' }],
    );
    expect(ira.value).toBeCloseTo(7, 10);
  });

  it('snapshot: turma Integral (carga 0) e turma regular usam o MESMO pipeline', () => {
    const integral = computeIraForStudent(data(), 'i1-aluno');
    const regular = computeIraForStudent(
      data({ subjects: [subj('a', 'MATEMATICA', 4), subj('b', 'FILOSOFIA', 1)], grades: [grade('a', 8), grade('b', 3)] }),
      'aluno',
    );
    const rows = buildSnapshotRows([
      { studentId: 'i1', status: 'active', classId: 'cIntegral', className: 'EPT 1', series: 'ept1', ira: integral, medals: [] },
      { studentId: 'r1', status: 'active', classId: 'cRegular', className: '1º A', series: '1', ira: regular, medals: [] },
    ], null, '2026-01-01T00:00:00.000Z');
    expect(rows[0].ira_value).toBeNull();
    expect(rows[1].ira_value).toBeCloseTo(7, 10);
  });
});
