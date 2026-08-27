import { describe, it, expect } from 'vitest';
import { CID_REGEX, isValidCid, lookupCatalog, normalizeCid } from '../cidLookup';

describe('normalizeCid', () => {
  it('remove ruído e aplica o ponto na subcategoria', () => {
    expect(normalizeCid('a09')).toBe('A09');
    expect(normalizeCid(' m 54.5 ')).toBe('M54.5');
    expect(normalizeCid('m545')).toBe('M54.5');
    expect(normalizeCid('J-11')).toBe('J11');
    expect(normalizeCid('')).toBe('');
  });
});

describe('validação de formato', () => {
  it('aceita apenas o padrão CID-10 básico', () => {
    expect(isValidCid('A09')).toBe(true);
    expect(isValidCid('M54.5')).toBe(true);
    expect(isValidCid('m545')).toBe(true);
    expect(isValidCid('AA9')).toBe(false);
    expect(isValidCid('123')).toBe(false);
    expect(isValidCid('A0')).toBe(false);
    expect(CID_REGEX.test('A099')).toBe(false);
  });
});

describe('lookupCatalog', () => {
  it('resolve código exato', () => {
    const r = lookupCatalog('m54.5');
    expect(r?.code).toBe('M54.5');
    expect(r?.source).toBe('catalog');
    expect(r?.status).toBe('ok');
    expect(r?.description).toBe('Dor lombar baixa');
  });

  it('faz fallback para a categoria de 3 caracteres', () => {
    const r = lookupCatalog('J45.0');
    expect(r?.description).toBe('Asma');
    expect(r?.code).toBe('J45.0');
  });

  it('retorna null e nunca inventa descrição', () => {
    expect(lookupCatalog('Q99')).toBeNull();
    expect(lookupCatalog('ZZZ')).toBeNull();
  });
});
