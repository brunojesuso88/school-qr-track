import { describe, expect, it } from 'vitest';
import { componentKey, planComponentImport } from '@/lib/curriculumMatrices';
import { OFFICIAL_CURRICULUM_MATRIX, officialMatrixForSeries } from '@/lib/curriculumMatrixData';

const comp = (subject_id: string, series: string, weekly_classes = 2) =>
  ({ subject_id, series, weekly_classes, include_in_ira: true });

describe('matrizes curriculares nomeadas', () => {
  it('identifica componente por disciplina + série + ocorrência (nunca por nome)', () => {
    expect(componentKey(comp('s1', '1'))).toBe('s1::1::1');
    expect(componentKey(comp('s1', '2'))).not.toBe(componentKey(comp('s1', '1')));
    // Ocorrências (slots) do mesmo componente na mesma série são distintas.
    expect(componentKey({ ...comp('s1', '1'), slot_index: 2 })).not.toBe(componentKey(comp('s1', '1')));
  });

  it('importa componentes de outra matriz preservando série/carga/IRA', () => {
    const source = [comp('s1', '1', 4), comp('s1', '2', 4), comp('s2', '3', 1)];
    const { toInsert, skipped } = planComponentImport(source, []);
    expect(skipped).toHaveLength(0);
    expect(toInsert).toHaveLength(3);
    expect(toInsert[0]).toMatchObject({ subject_id: 's1', series: '1', weekly_classes: 4, include_in_ira: true });
  });

  it('não duplica componente que já existe na matriz destino', () => {
    const source = [comp('s1', '1'), comp('s2', '1')];
    const target = [comp('s1', '1')];
    const { toInsert, skipped } = planComponentImport(source, target);
    expect(toInsert.map((c) => c.subject_id)).toEqual(['s2']);
    expect(skipped.map((c) => c.subject_id)).toEqual(['s1']);
  });

  it('é idempotente: reimportar a mesma seleção não insere nada', () => {
    const source = [comp('s1', '1'), comp('s2', '2')];
    const first = planComponentImport(source, []);
    const second = planComponentImport(source, first.toInsert);
    expect(second.toInsert).toHaveLength(0);
    expect(second.skipped).toHaveLength(2);
  });

  it('ignora duplicatas repetidas dentro da própria seleção de origem', () => {
    const { toInsert, skipped } = planComponentImport([comp('s1', '1'), comp('s1', '1')], []);
    expect(toInsert).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  it('modelo da Matriz Original permanece com 18 componentes e as cargas oficiais', () => {
    expect(OFFICIAL_CURRICULUM_MATRIX).toHaveLength(18);
    expect(officialMatrixForSeries('1')).toHaveLength(16);
    expect(officialMatrixForSeries('2')).toHaveLength(16);
    expect(officialMatrixForSeries('3')).toHaveLength(16);
    const total = (s: '1' | '2' | '3') =>
      officialMatrixForSeries(s).reduce((sum, i) => sum + i.weekly_classes, 0);
    expect(total('1')).toBe(28);
    expect(total('2')).toBe(30);
    expect(total('3')).toBe(30);
    expect(officialMatrixForSeries('1').every((s) => s.include_in_ira)).toBe(true);
  });
});
