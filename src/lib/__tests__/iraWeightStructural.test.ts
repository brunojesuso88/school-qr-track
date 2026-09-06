/**
 * PESO EXPLÍCITO DO IRA — associação ESTRUTURAL e fallback textual seguro.
 *
 * Regras verificadas:
 *  - componentes legítimos repetidos (mesmo nome canônico em slots diferentes) NUNCA colapsam;
 *  - sem `curriculum_matrix_subject_id`, o nome só entrega peso quando a correspondência
 *    canônica é ÚNICA; com 2+ candidatos o peso é pendente (null);
 *  - `slot_index` desambigua com segurança;
 *  - a carga semanal jamais deriva peso.
 */
import { describe, expect, it } from 'vitest';
import {
  buildMatrixIraWeightByClass, buildMatrixIraWeightIndex, emptyIraWeightIndex,
  resolveExplicitIraWeight, type MatrixIraWeightScopedRow,
} from '@/lib/curriculumMatrixIraWeight';
import { computeIraForStudent, type ClassGradesData } from '@/hooks/useStudentGrades';

const comp = (
  id: string, name: string, slot: number, weight: number | null, series = '1', matrix = 'mSchool',
): MatrixIraWeightScopedRow => ({
  id, matrix_id: matrix, series, slot_index: slot, ira_weight: weight, name, aliases: null,
});

const gs = (over: Partial<Parameters<typeof resolveExplicitIraWeight>[0]> & { name: string }) => ({
  ira_weight: null, curriculum_matrix_subject_id: null, slot_index: null, ...over,
});

describe('índice de pesos: duplicidades por slot_index são independentes', () => {
  const rows = [comp('c1', 'APROFUNDAMENTO IF - I', 1, 1), comp('c2', 'APROFUNDAMENTO IF - I', 2, 4)];
  const index = buildMatrixIraWeightIndex(rows);

  it('cada componente mantém o SEU peso pelo vínculo estrutural', () => {
    expect(index.byComponentId.c1).toBe(1);
    expect(index.byComponentId.c2).toBe(4);
    expect(resolveExplicitIraWeight(gs({ name: 'APROFUNDAMENTO IF - I', curriculum_matrix_subject_id: 'c1' }), index)).toBe(1);
    expect(resolveExplicitIraWeight(gs({ name: 'APROFUNDAMENTO IF - I', curriculum_matrix_subject_id: 'c2' }), index)).toBe(4);
  });

  it('nome ambíguo (2 candidatos) NÃO herda o primeiro: fica pendente', () => {
    expect(index.byKey['aprofundamento if - i']).toBeUndefined();
    expect(resolveExplicitIraWeight(gs({ name: 'APROFUNDAMENTO IF - I' }), index)).toBeNull();
  });

  it('slot_index desambigua a linha legada sem vínculo estrutural', () => {
    expect(resolveExplicitIraWeight(gs({ name: 'APROFUNDAMENTO IF - I', slot_index: 2 }), index)).toBe(4);
  });

  it('vínculo estrutural inexistente na matriz não cai no nome', () => {
    expect(resolveExplicitIraWeight(gs({ name: 'APROFUNDAMENTO IF - I', curriculum_matrix_subject_id: 'zzz' }), index)).toBeNull();
  });
});

describe('correspondência canônica única', () => {
  const index = buildMatrixIraWeightIndex([
    comp('m1', 'MATEMÁTICA', 1, 4), comp('f1', 'FILOSOFIA', 2, 2),
  ]);

  it('um único candidato pode herdar o peso explícito da matriz', () => {
    expect(resolveExplicitIraWeight(gs({ name: 'Matematica' }), index)).toBe(4);
    expect(resolveExplicitIraWeight(gs({ name: 'FILOSOFIA' }), index)).toBe(2);
  });

  it('sem candidato o peso é pendente', () => {
    expect(resolveExplicitIraWeight(gs({ name: 'ELETIVA' }), index)).toBeNull();
    expect(resolveExplicitIraWeight(gs({ name: 'ELETIVA' }), undefined)).toBeNull();
    expect(resolveExplicitIraWeight(gs({ name: 'ELETIVA' }), emptyIraWeightIndex())).toBeNull();
  });

  it('peso do próprio grade_subject prevalece sobre a matriz', () => {
    expect(resolveExplicitIraWeight(gs({ name: 'MATEMÁTICA', ira_weight: 1 }), index)).toBe(1);
  });

  it('peso inválido na matriz (0/negativo) não entra no índice', () => {
    const bad = buildMatrixIraWeightIndex([comp('x', 'ELETIVA', 1, 0), comp('y', 'CLUBE', 2, null)]);
    expect(bad.byComponentId).toEqual({});
    expect(resolveExplicitIraWeight(gs({ name: 'ELETIVA' }), bad)).toBeNull();
  });
});

describe('matriz efetiva por turma', () => {
  const rows = [
    comp('a1', 'MATEMÁTICA', 1, 4, '1', 'mSchool'),
    comp('b1', 'MATEMÁTICA', 1, 1, '1', 'mOutra'),
  ];

  it('turma sem matriz usa a matriz VIGENTE da escola (não outra qualquer)', () => {
    const byClass = buildMatrixIraWeightByClass(
      [
        { id: 'turmaLegado', series: '1', curriculum_matrix_id: null },
        { id: 'turmaOutra', series: '1', curriculum_matrix_id: 'mOutra' },
      ],
      rows,
      'mSchool', // matriz vigente da escola
    );
    expect(byClass.get('turmaLegado')!.byKey['matematica']).toBe(4);
    expect(byClass.get('turmaOutra')!.byKey['matematica']).toBe(1);
  });

  it('sem série ou sem matriz efetiva o índice fica vazio', () => {
    const byClass = buildMatrixIraWeightByClass(
      [
        { id: 'semSerie', series: null, curriculum_matrix_id: 'mSchool' },
        { id: 'semMatriz', series: '1', curriculum_matrix_id: null },
      ],
      rows,
      null,
    );
    expect(byClass.get('semSerie')).toEqual(emptyIraWeightIndex());
    expect(byClass.get('semMatriz')).toEqual(emptyIraWeightIndex());
  });
});

describe('carga semanal nunca vira peso', () => {
  const P1 = {
    id: 'p1', class_id: 'c1', label: '1º Período', normalized_label: '1º periodo',
    kind: 'period', sort_order: 1,
  };

  const data = (): ClassGradesData => ({
    subjects: [{
      id: 'sub-amb', class_id: 'c1', name: 'APROFUNDAMENTO IF - I',
      normalized_name: 'aprofundamento if - i', mapping_class_subject_id: null,
      weekly_classes: 4, include_in_ira: true, custom_ira_weight: null,
      ira_weight: null, curriculum_matrix_subject_id: null, slot_index: null, sort_order: 1,
    }],
    periods: [P1],
    grades: [{
      id: 'g1', student_id: 'aluno', grade_subject_id: 'sub-amb', grade_period_id: 'p1',
      value: 9, raw_text: null, confidence: null, flags: [], source: 'test',
    }],
    settings: {
      id: 's1', class_id: 'c1', ira_period_id: null, ira_period_ids: ['p1'],
      use_final_grade: false, scale_max: 10,
    },
    currentWeeklyClasses: {},
    matrixWeeklyByKey: { 'aprofundamento if - i': 4 },
    matrixIraWeights: buildMatrixIraWeightIndex([
      comp('c1', 'APROFUNDAMENTO IF - I', 1, 1), comp('c2', 'APROFUNDAMENTO IF - I', 2, 4),
    ]),
  });

  it('weekly_classes=4 + peso ausente + nome ambíguo => pendente, nunca peso 4', () => {
    const ira = computeIraForStudent(data(), 'aluno');
    expect(ira.lines[0].weight).toBeNull();
    expect(ira.lines[0].weightSource).toBe('none');
    expect(ira.value).toBeNull();
  });
});
