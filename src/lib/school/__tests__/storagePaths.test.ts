import { describe, expect, it } from 'vitest';
import { schoolIdFromStoragePath, schoolScopedPath } from '../storagePaths';

const SCHOOL = '11111111-2222-3333-4444-555555555555';

describe('schoolScopedPath', () => {
  it('prefixa com a pasta da escola', () => {
    expect(schoolScopedPath(SCHOOL, 'covers/a.jpg')).toBe(`schools/${SCHOOL}/covers/a.jpg`);
  });

  it('mantém caminho legado sem escola ativa', () => {
    expect(schoolScopedPath(null, 'covers/a.jpg')).toBe('covers/a.jpg');
  });

  it('não duplica o prefixo', () => {
    const p = `schools/${SCHOOL}/covers/a.jpg`;
    expect(schoolScopedPath(SCHOOL, p)).toBe(p);
  });

  it('remove barras iniciais', () => {
    expect(schoolScopedPath(null, '/x/y.png')).toBe('x/y.png');
  });
});

describe('schoolIdFromStoragePath', () => {
  it('extrai o id da escola', () => {
    expect(schoolIdFromStoragePath(`schools/${SCHOOL}/a/b.jpg`)).toBe(SCHOOL);
  });

  it('retorna null para legado', () => {
    expect(schoolIdFromStoragePath('a/b.jpg')).toBeNull();
    expect(schoolIdFromStoragePath('schools/nao-uuid/b.jpg')).toBeNull();
    expect(schoolIdFromStoragePath(null)).toBeNull();
  });
});
