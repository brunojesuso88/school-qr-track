import { describe, expect, it } from 'vitest';
import {
  DROPOUT_STATUS, buildSnapshotRows, isDropout, resolveDisplayState, resolveIraFreshness, splitByEligibility,
} from '../core';
import { computeMedals, MedalStudentInput } from '@/lib/medals/compute';
import { ClassGradesData } from '@/hooks/useStudentGrades';

describe('desistentes', () => {
  it('reconhece o status real de desistente', () => {
    expect(DROPOUT_STATUS).toBe('inactive');
    expect(isDropout('inactive')).toBe(true);
    expect(isDropout('active')).toBe(false);
    expect(isDropout(null)).toBe(false);
  });

  it('separa elegíveis de desistentes', () => {
    const { eligible, dropouts } = splitByEligibility([
      { id: 'a', status: 'active' },
      { id: 'b', status: 'inactive' },
      { id: 'c', status: null },
    ]);
    expect(eligible.map((s) => s.id)).toEqual(['a', 'c']);
    expect(dropouts.map((s) => s.id)).toEqual(['b']);
  });

  it('limpa cache antigo de desistente ao recalcular', () => {
    const [row] = buildSnapshotRows([
      {
        studentId: 'x',
        status: 'inactive',
        classId: 'c1',
        className: 'T1',
        series: '1',
        ira: { status: 'ok', value: 9.9, lines: [] } as never,
        medals: [{ areaId: 'matematica' } as never],
      },
    ], null, '2026-01-01T00:00:00.000Z');
    expect(row.eligible).toBe(false);
    expect(row.ira_value).toBeNull();
    expect(row.medals).toEqual([]);
    expect(row.ira_status).toBe('ineligible');
  });

  it('persiste IRA e medalhas de aluno ativo', () => {
    const [row] = buildSnapshotRows([
      {
        studentId: 'y',
        status: 'active',
        classId: 'c1',
        className: 'T1',
        series: '2',
        ira: { status: 'ok', value: 8.25, lines: [] } as never,
        medals: [{ areaId: 'humanas' } as never],
      },
    ], 'user-1');
    expect(row.eligible).toBe(true);
    expect(row.ira_value).toBe(8.25);
    expect(row.medals).toHaveLength(1);
    expect(row.computed_by).toBe('user-1');
  });
});

describe('estado de exibição', () => {
  it('nunca calculado', () => {
    expect(resolveDisplayState({ hasSnapshot: false, stale: false })).toBe('never');
  });
  it('desatualizado mantém último valor visível', () => {
    expect(resolveDisplayState({ hasSnapshot: true, stale: true })).toBe('stale');
  });
  it('atualizado', () => {
    expect(resolveDisplayState({ hasSnapshot: true, stale: false })).toBe('fresh');
  });
});

/** Dados mínimos de turma com uma disciplina de Matemática e um período. */
function classData(values: Record<string, number>): ClassGradesData {
  return {
    subjects: [{
      id: 'sub-mat', class_id: 'c1', name: 'Matemática', normalized_name: 'matematica',
      mapping_class_subject_id: null, weekly_classes: 4, include_in_ira: true,
      custom_ira_weight: null, sort_order: 0, legacy_excluded: false,
    } as never],
    periods: [{
      id: 'per-1', class_id: 'c1', label: '1º Período', normalized_label: '1 periodo',
      kind: 'period', sort_order: 0,
    } as never],
    grades: Object.entries(values).map(([studentId, value]) => ({
      id: `g-${studentId}`, student_id: studentId, grade_subject_id: 'sub-mat',
      grade_period_id: 'per-1', value, raw_text: null, confidence: null, flags: [],
      source: 'manual', import_id: null,
    } as never)),
    settings: { class_id: 'c1', ira_period_ids: ['per-1'], use_final_grade: false, scale_max: 10 } as never,
    currentWeeklyClasses: {},
  };
}

describe('medalhas x desistentes', () => {
  it('desistente com a maior nota não vence: vencedor é aluno ativo', () => {
    const data = classData({ dropout: 10, active: 7 });
    const inputs: MedalStudentInput[] = [
      { studentId: 'dropout', series: '1', data },
      { studentId: 'active', series: '1', data },
    ]
      // filtro aplicado ANTES do cálculo, como no recompute
      .filter((i) => !isDropout(i.studentId === 'dropout' ? 'inactive' : 'active'));

    const medals = computeMedals(inputs);
    expect(medals.dropout).toBeUndefined();
    const mat = (medals.active || []).find((m) => m.areaId === 'matematica');
    expect(mat).toBeDefined();
    expect(mat?.shared).toBe(false);
  });

  it('empate entre ativos condecora ambos', () => {
    const data = classData({ a: 9, b: 9 });
    const medals = computeMedals([
      { studentId: 'a', series: '1', data },
      { studentId: 'b', series: '1', data },
    ]);
    expect(medals.a?.some((m) => m.areaId === 'matematica' && m.shared)).toBe(true);
    expect(medals.b?.some((m) => m.areaId === 'matematica' && m.shared)).toBe(true);
  });
});

describe('estado salvo do IRA (staleness)', () => {
  it('A) turma sem linha de staleness = nunca calculado, não desatualizado', () => {
    const r = resolveIraFreshness({ hasSnapshot: false, rows: [] });
    expect(r.neverCalculated).toBe(true);
    expect(r.stale).toBe(false);
  });

  it('B/C) após cálculo salvo, sem marcação = atualizado e permanece assim', () => {
    const rows = [{ stale: false, last_computed_at: '2026-09-03T12:00:00.000Z' }];
    const r = resolveIraFreshness({ hasSnapshot: true, rows });
    expect(r.stale).toBe(false);
    expect(r.neverCalculated).toBe(false);
    expect(r.lastComputedAt).toBe('2026-09-03T12:00:00.000Z');
    expect(resolveDisplayState({ hasSnapshot: true, stale: r.stale })).toBe('fresh');
  });

  it('D/F) qualquer turma marcada deixa o escopo desatualizado', () => {
    const r = resolveIraFreshness({
      hasSnapshot: true,
      rows: [
        { stale: false, last_computed_at: '2026-09-01T00:00:00.000Z' },
        { stale: true, last_computed_at: '2026-09-01T00:00:00.000Z' },
      ],
    });
    expect(r.stale).toBe(true);
    expect(resolveDisplayState({ hasSnapshot: true, stale: r.stale })).toBe('stale');
  });

  it('G) turma sem linha ao lado de turma calculada não gera aviso de desatualizado', () => {
    const r = resolveIraFreshness({
      hasSnapshot: true,
      rows: [{ stale: false, last_computed_at: '2026-09-01T00:00:00.000Z' }],
    });
    expect(r.stale).toBe(false);
  });
});
