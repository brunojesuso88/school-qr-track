import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SCHOOL_NAME,
  cityDateLine,
  documentSchoolName,
  formatCityState,
  splitSchoolNameLines,
} from '../documentBranding';

describe('documentSchoolName', () => {
  it('usa fallback neutro quando não há nome configurado', () => {
    expect(documentSchoolName('')).toBe(FALLBACK_SCHOOL_NAME);
    expect(documentSchoolName(null)).toBe(FALLBACK_SCHOOL_NAME);
  });

  it('não contém nome hardcoded de escola', () => {
    expect(FALLBACK_SCHOOL_NAME.toUpperCase()).not.toContain('NONATO');
  });

  it('preserva o nome da escola ativa', () => {
    expect(documentSchoolName('  Escola Alfa ')).toBe('Escola Alfa');
  });
});

describe('formatCityState', () => {
  it('monta cidade e UF', () => {
    expect(formatCityState('Coelho Neto', 'ma')).toBe('Coelho Neto - MA');
    expect(formatCityState('Coelho Neto', 'MA', '/')).toBe('Coelho Neto/MA');
  });

  it('tolera campos ausentes', () => {
    expect(formatCityState('', '')).toBe('');
    expect(formatCityState('Fortaleza', null)).toBe('Fortaleza');
    expect(formatCityState(null, 'CE')).toBe('CE');
  });
});

describe('cityDateLine', () => {
  it('omite o local quando não configurado', () => {
    expect(cityDateLine('', '01/01/2026')).toBe('01/01/2026');
    expect(cityDateLine('Bacabal/MA', '01/01/2026')).toBe('Bacabal/MA, 01/01/2026');
  });
});

describe('splitSchoolNameLines', () => {
  it('divide nomes longos em duas linhas', () => {
    const [a, b] = splitSchoolNameLines('Centro de Ensino Escola Modelo Dois');
    expect(a).toBe('CENTRO DE ENSINO');
    expect(b).toBe('ESCOLA MODELO DOIS');
  });

  it('mantém nomes curtos em uma linha', () => {
    expect(splitSchoolNameLines('Escola Alfa')).toEqual(['', 'ESCOLA ALFA']);
  });
});
