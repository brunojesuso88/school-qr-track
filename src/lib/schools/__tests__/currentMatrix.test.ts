/**
 * MATRIZ VIGENTE DA ESCOLA — seleção pré-preenchida, escopo por escola e
 * ausência de trabalho extra ao salvar sem trocar a matriz.
 */
import { describe, expect, it } from 'vitest';
import {
  matrixOptionsForSchool, needsMatrixUpdate, preselectedMatrixId,
} from '@/lib/schools/currentMatrix';
import type { CurriculumMatrixRecord } from '@/lib/curriculumMatrices';

const m = (id: string, schoolId: string, name: string): CurriculumMatrixRecord => ({
  id,
  school_id: schoolId,
  name,
  description: null,
  is_original: name === 'Matriz Original',
  system_key: name === 'Matriz Original' ? 'original' : null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  components: 10,
} as unknown as CurriculumMatrixRecord);

const A = 'escola-a';
const B = 'escola-b';
const list = [m('a1', A, 'Matriz Original'), m('a2', A, 'Matriz Integral'), m('b1', B, 'Matriz Original')];

describe('selector de matriz em Gerenciar escola', () => {
  it('oferece SOMENTE matrizes da escola gerenciada', () => {
    expect(matrixOptionsForSchool(list, A).map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(matrixOptionsForSchool(list, B).map((x) => x.id)).toEqual(['b1']);
  });

  it('vem pré-preenchido com a matriz vigente da escola', () => {
    expect(preselectedMatrixId(list, A, 'a2')).toBe('a2');
  });

  it('nunca pré-seleciona matriz de outra escola nem valor inexistente', () => {
    expect(preselectedMatrixId(list, A, 'b1')).toBe('');
    expect(preselectedMatrixId(list, A, null)).toBe('');
  });

  it('salvar sem trocar a matriz não gera atualização', () => {
    expect(needsMatrixUpdate('a2', 'a2')).toBe(false);
    expect(needsMatrixUpdate('a2', '')).toBe(false);
    expect(needsMatrixUpdate('a2', 'a1')).toBe(true);
    expect(needsMatrixUpdate(null, 'a1')).toBe(true);
  });
});
