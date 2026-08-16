import { describe, expect, it } from 'vitest';
import { digitsOnly, extractSchoolCodeFromText, sanitizeSchoolCodeForStorage } from '../studentMatch';

describe('código do aluno', () => {
  it('captura o código completo, sem truncar no separador', () => {
    expect(extractSchoolCodeFromText('26.123.456')).toBe('26123456');
    expect(extractSchoolCodeFromText(' 26 123 456 ')).toBe('26123456');
    expect(extractSchoolCodeFromText('0012.345-6')).toBe('00123456');
  });

  it('preserva zeros à esquerda ao armazenar e ignora-os ao comparar', () => {
    expect(sanitizeSchoolCodeForStorage('0012.345')).toBe('0012345');
    expect(digitsOnly('0012.345')).toBe(digitsOnly('12345'));
  });

  it('sem dígitos => null', () => {
    expect(extractSchoolCodeFromText('—')).toBeNull();
    expect(sanitizeSchoolCodeForStorage(null)).toBeNull();
  });
});
