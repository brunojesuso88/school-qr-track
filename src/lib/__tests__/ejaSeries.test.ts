import { describe, expect, it } from 'vitest';
import {
  CLASS_SERIES_OPTIONS, classSeriesLabel, isEjaSeries, normalizeSeriesList,
  parseSeriesValue, seriesListMatches, seriesShortLabel,
} from '@/lib/series';
import { OFFICIAL_CURRICULUM_MATRIX, officialMatrixForSeries } from '@/lib/curriculumMatrixData';
import { selectMissingMatrixSubjects } from '@/lib/curriculumMatrixCore';
import type { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';

const total = (s: '1' | '2' | '3' | 'eja1' | 'eja2') =>
  officialMatrixForSeries(s).reduce((sum, i) => sum + i.weekly_classes, 0);

describe('etapas EJA como série/etapa canônica', () => {
  it('reconhece os rótulos do EJA', () => {
    expect(parseSeriesValue('1ª Etapa EJA')).toBe('eja1');
    expect(parseSeriesValue('1 Etapa EJA')).toBe('eja1');
    expect(parseSeriesValue('1ª etapa')).toBe('eja1');
    expect(parseSeriesValue('EJA 1ª Etapa')).toBe('eja1');
    expect(parseSeriesValue('eja1')).toBe('eja1');
    expect(parseSeriesValue('2ª Etapa EJA')).toBe('eja2');
    expect(parseSeriesValue('2 etapa eja')).toBe('eja2');
    expect(parseSeriesValue('eja2')).toBe('eja2');
  });

  it('NUNCA confunde EJA com o Ensino Médio regular', () => {
    expect(parseSeriesValue('1º ano do Ensino Médio')).toBe('1');
    expect(parseSeriesValue('2º ano do Ensino Médio')).toBe('2');
    expect(parseSeriesValue('3ª Série do Ensino Médio')).toBe('3');
    expect(parseSeriesValue('1ª Etapa EJA')).not.toBe('1');
    expect(parseSeriesValue('2ª Etapa EJA')).not.toBe('2');
    expect(parseSeriesValue('1ª Etapa EJA e 2ª Etapa EJA')).toBeNull();
    expect(isEjaSeries('1')).toBe(false);
    expect(isEjaSeries('eja1')).toBe(true);
  });

  it('rótulos exatos das etapas', () => {
    expect(classSeriesLabel('eja1')).toBe('1ª Etapa EJA');
    expect(classSeriesLabel('eja2')).toBe('2ª Etapa EJA');
    expect(seriesShortLabel('eja1')).toBe('1ª Etapa EJA');
    expect(seriesShortLabel('1')).toBe('1º ano');
    expect(CLASS_SERIES_OPTIONS.map((o) => o.value))
      .toEqual(['1', '2', '3', 'eja1', 'eja2', 'ept1', 'eve2', 'sec2', 'eve3', 'sec3']);
  });

  it('normalizeSeriesList e seriesListMatches suportam EJA', () => {
    expect(normalizeSeriesList(['1ª Etapa EJA', '2 etapa eja', '1º ano'])).toEqual(['1', 'eja1', 'eja2']);
    expect(seriesListMatches('eja2', ['eja1', 'eja2'])).toBe(true);
    expect(seriesListMatches('eja2', ['1', '2', '3'])).toBe(false);
    expect(seriesListMatches('1', ['eja1'])).toBe(false);
  });
});

describe('Matriz Original — etapas EJA', () => {
  it('1ª Etapa EJA: 14 componentes, 25 aulas/semana', () => {
    const items = officialMatrixForSeries('eja1');
    expect(items).toHaveLength(14);
    expect(total('eja1')).toBe(25);
    expect(items.map((i) => i.name).sort()).toEqual([
      'ARTE', 'BIOLOGIA', 'FILOSOFIA', 'FISICA', 'GEOGRAFIA', 'HISTORIA',
      'IDENTIDADE E PROTAGONISMO', 'LETRAMENTO EM LINGUA PORTUGUESA',
      'LETRAMENTO EM MATEMATICA', 'LINGUA INGLESA', 'LINGUA PORTUGUESA',
      'MATEMATICA', 'QUIMICA', 'SOCIOLOGIA',
    ]);
    expect(items.every((i) => i.include_in_ira)).toBe(true);
  });

  it('2ª Etapa EJA: 13 componentes, 25 aulas/semana', () => {
    const items = officialMatrixForSeries('eja2');
    expect(items).toHaveLength(13);
    expect(total('eja2')).toBe(25);
    expect(items.map((i) => i.name).sort()).toEqual([
      'APROFUNDAMENTO IF - I', 'ARTE', 'BIOLOGIA', 'EDUCACAO DIGITAL', 'FILOSOFIA',
      'FISICA', 'GEOGRAFIA', 'HISTORIA', 'LINGUA INGLESA', 'LINGUA PORTUGUESA',
      'MATEMATICA', 'QUIMICA', 'SOCIOLOGIA',
    ]);
  });

  it('2ª Etapa EJA tem Aprofundamento I e NÃO tem o II', () => {
    const names = officialMatrixForSeries('eja2').map((i) => i.name);
    expect(names).toContain('APROFUNDAMENTO IF - I');
    expect(names).not.toContain('APROFUNDAMENTO IF - II');
  });

  it('nenhuma regressão nas séries regulares', () => {
    expect(OFFICIAL_CURRICULUM_MATRIX).toHaveLength(18);
    expect(officialMatrixForSeries('1')).toHaveLength(16);
    expect(officialMatrixForSeries('2')).toHaveLength(16);
    expect(officialMatrixForSeries('3')).toHaveLength(16);
    expect(total('1')).toBe(28);
    expect(total('2')).toBe(30);
    expect(total('3')).toBe(30);
  });

  it('aliases SEA/CNS/ETT/CHL do Aprofundamento I valem na 2ª Etapa EJA', () => {
    const ap = officialMatrixForSeries('eja2').find((i) => i.name === 'APROFUNDAMENTO IF - I')!;
    ['SEA', 'CNS', 'ETT', 'CHL'].forEach((axis) => {
      expect(ap.aliases).toContain(`APROFUNDAMENTO IF - ${axis} - I`);
      expect(ap.aliases).not.toContain(`APROFUNDAMENTO IF - ${axis} - II`);
    });
  });

  it('selectMissingMatrixSubjects não duplica Aprofundamento por alias na 2ª Etapa EJA', () => {
    const ap = officialMatrixForSeries('eja2').find((i) => i.name === 'APROFUNDAMENTO IF - I')!;
    const matrix: CurriculumMatrixItem[] = [{
      id: 'c1', subject_id: 's1', series: 'eja2', weekly_classes: ap.weekly_classes,
      include_in_ira: true, name: ap.name, abbreviation: ap.abbreviation, aliases: ap.aliases,
    }];
    expect(selectMissingMatrixSubjects(matrix, [{ subject_name: 'APROFUNDAMENTO IF - SEA - I' }])).toHaveLength(0);
    expect(selectMissingMatrixSubjects(matrix, [{ subject_name: 'APROFUNDAMENTO IF - SEA - II' }])).toHaveLength(1);
  });
});
