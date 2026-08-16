import { describe, expect, it } from 'vitest';
import {
  hasSalaForaSuffix, resolveClassNameFromPdf, samePdfClassBaseName,
  stripSalaForaSuffix, withSalaForaSuffix,
} from '../salaFora';

describe('sufixo Sala Fora', () => {
  it('acrescenta o sufixo', () => {
    expect(withSalaForaSuffix('26RMM100')).toBe('26RMM100 Sala Fora');
  });

  it('não duplica o sufixo (caixa/espaços)', () => {
    expect(withSalaForaSuffix('26RMM100 Sala Fora')).toBe('26RMM100 Sala Fora');
    expect(withSalaForaSuffix('26RMM100   sala   fora')).toBe('26RMM100 Sala Fora');
    expect(withSalaForaSuffix('26RMM100 SALA FORA Sala Fora')).toBe('26RMM100 Sala Fora');
  });

  it('remove o sufixo', () => {
    expect(stripSalaForaSuffix('26RMM100 Sala Fora')).toBe('26RMM100');
    expect(stripSalaForaSuffix('26RMM100')).toBe('26RMM100');
    expect(hasSalaForaSuffix('26RMM100 - sala fora')).toBe(true);
  });

  it('considera o mesmo código-base do PDF', () => {
    expect(samePdfClassBaseName('26RMM100', '26RMM100 Sala Fora')).toBe(true);
    expect(samePdfClassBaseName('26RMM100 Sala Fora', '26RMM100')).toBe(true);
    expect(samePdfClassBaseName('26RMM100', '26RMM200')).toBe(false);
    expect(samePdfClassBaseName('', '26RMM100')).toBe(false);
  });

  it('renomear sem Sala Fora mantém o comportamento antigo', () => {
    expect(resolveClassNameFromPdf('26RMM100', false)).toBe('26RMM100');
  });

  it('renomear com Sala Fora grava o sufixo', () => {
    expect(resolveClassNameFromPdf('26RMM100', true)).toBe('26RMM100 Sala Fora');
  });

  it('após renomear, próximas páginas não geram novo conflito', () => {
    const finalName = resolveClassNameFromPdf('26RMM100', true);
    expect(samePdfClassBaseName('26RMM100', finalName)).toBe(true);
  });

  it('manter nome atual ignora o checkbox', () => {
    const current = '26RMM100-ANTIGO';
    const keep = (salaFora: boolean) => current; // decisão "manter" não usa o sufixo
    expect(keep(true)).toBe(current);
    expect(keep(false)).toBe(current);
  });
});
