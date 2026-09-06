/**
 * Classificação universal dos componentes + PESO EXPLÍCITO do IRA.
 *
 * Regras verificadas:
 *  - Formação Geral Básica (fgb) = 2, exceto MATEMÁTICA e LÍNGUA PORTUGUESA = 4;
 *  - Itinerários Formativos (itinerario) = 1, sem exceção (nem Matemática);
 *  - o cálculo usa `ira_weight`, nunca a carga semanal;
 *  - peso personalizado da turma continua prevalecendo.
 */
import { describe, expect, it } from 'vitest';
import {
  IRA_CLASSIFICATIONS, calculateIraMultiPeriod, defaultIraWeight, resolveWeight, suggestClassification,
} from '@/lib/ira';

const PERIODS = [{ id: 'p1', label: '1º Período' }];

describe('pesos padrão por classificação', () => {
  it('FGB comum = 2', () => {
    expect(defaultIraWeight('fgb', 'FÍSICA')).toBe(2);
    expect(defaultIraWeight('fgb', 'História')).toBe(2);
  });

  it('FGB Matemática e Língua Portuguesa = 4', () => {
    expect(defaultIraWeight('fgb', 'MATEMÁTICA')).toBe(4);
    expect(defaultIraWeight('fgb', 'Língua Portuguesa')).toBe(4);
  });

  it('Itinerários Formativos = 1 sem exceção', () => {
    expect(defaultIraWeight('itinerario', 'MATEMÁTICA')).toBe(1);
    expect(defaultIraWeight('itinerario', 'LÍNGUA PORTUGUESA')).toBe(1);
    expect(defaultIraWeight('itinerario', 'APROFUNDAMENTO IF - I')).toBe(1);
  });

  it('as duas classificações existem e nenhuma é nula', () => {
    expect(IRA_CLASSIFICATIONS).toEqual(['fgb', 'itinerario']);
    IRA_CLASSIFICATIONS.forEach((c) => expect(defaultIraWeight(c, 'QUALQUER')).toBeGreaterThan(0));
  });

  it('sugestão inicial: percurso/itinerário fora da formação geral', () => {
    expect(suggestClassification('MATEMÁTICA')).toBe('fgb');
    expect(suggestClassification('APROFUNDAMENTO IF - CHL - I')).toBe('itinerario');
    expect(suggestClassification('PROJETO DE VIDA')).toBe('itinerario');
  });
});

describe('cálculo usa o peso explícito', () => {
  const line = (id: string, name: string, weekly: number | null, iraWeight: number | null, value: number) => ({
    subjectId: id,
    name,
    weeklyClasses: weekly,
    iraWeight,
    includeInIra: true,
    customWeight: null,
    valuesByPeriod: { p1: value },
  });

  it('a carga semanal NÃO altera o peso: (8×4 + 6×1)/5 = 7,60', () => {
    const ira = calculateIraMultiPeriod(
      [
        // carga semanal absurda de propósito: não influencia nada.
        line('a', 'MATEMÁTICA', 99, 4, 8),
        line('b', 'APROFUNDAMENTO IF - I', 0, 1, 6),
      ],
      PERIODS,
    );
    expect(ira.totalWeight).toBe(5);
    expect(ira.value).toBeCloseTo(7.6, 10);
    expect(ira.lines.every((l) => l.weightSource === 'matrix')).toBe(true);
  });

  it('componente sem peso configurado fica pendente e fora do cálculo', () => {
    const ira = calculateIraMultiPeriod([line('a', 'ELETIVA', 2, null, 9)], PERIODS);
    expect(ira.value).toBeNull();
    expect(ira.lines[0].weight).toBeNull();
    expect(ira.lines[0].reason).toContain('Peso do IRA não configurado');
  });

  it('peso personalizado da turma prevalece sobre o peso da matriz', () => {
    expect(resolveWeight({ iraWeight: 4, customWeight: 1 })).toEqual({ weight: 1, source: 'custom' });
    expect(resolveWeight({ iraWeight: 4, customWeight: null })).toEqual({ weight: 4, source: 'matrix' });
    expect(resolveWeight({ iraWeight: null, customWeight: null })).toEqual({ weight: null, source: 'none' });
  });
});
