/**
 * Regressão: escolher uma matriz VAZIA (ou sem componentes para a série da turma)
 * não pode alterar/auditar `classes.curriculum_matrix_id`. A validação acontece
 * ANTES da troca, então o vínculo anterior permanece intacto.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const assignMatrixToClass = vi.fn();
const assertMatrixInSchool = vi.fn();
const fetchCurriculumMatrix = vi.fn();
const classesUpdate = vi.fn();

vi.mock('@/lib/curriculumMatrices', () => ({
  assertMatrixInSchool: (...args: unknown[]) => assertMatrixInSchool(...args),
  assignMatrixToClass: (...args: unknown[]) => assignMatrixToClass(...args),
  fetchOriginalMatrixId: vi.fn(async () => 'matrix-original'),
}));

vi.mock('@/lib/curriculumMatrix', () => ({
  fetchCurriculumMatrix: (...args: unknown[]) => fetchCurriculumMatrix(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'classes') {
        return { update: (...a: unknown[]) => { classesUpdate(...a); return { eq: async () => ({ error: null }) }; } };
      }
      throw new Error(`tabela inesperada no teste: ${table}`);
    },
  },
}));

import { syncClassCurriculum } from '../sync';

describe('troca de matriz da turma', () => {
  beforeEach(() => {
    assignMatrixToClass.mockClear();
    assertMatrixInSchool.mockClear();
    classesUpdate.mockClear();
    assertMatrixInSchool.mockResolvedValue(undefined);
  });

  it('matriz sem componentes para a série: falha clara e vínculo anterior mantido', async () => {
    fetchCurriculumMatrix.mockResolvedValue([]);
    await expect(
      syncClassCurriculum('turma-1', '1', { schoolId: 'escola-1', matrixId: 'matriz-vazia' }),
    ).rejects.toThrow(/não tem componentes para esta série/i);

    expect(assertMatrixInSchool).toHaveBeenCalledWith('matriz-vazia', 'escola-1');
    // Nada foi alterado/auditado na turma.
    expect(assignMatrixToClass).not.toHaveBeenCalled();
    expect(classesUpdate).not.toHaveBeenCalled();
  });

  it('série inválida nem chega a consultar a matriz', async () => {
    fetchCurriculumMatrix.mockResolvedValue([]);
    await expect(
      syncClassCurriculum('turma-1', 'faculdade', { schoolId: 'escola-1', matrixId: 'm1' }),
    ).rejects.toThrow(/Série da turma inválida/i);
    expect(assertMatrixInSchool).not.toHaveBeenCalled();
    expect(assignMatrixToClass).not.toHaveBeenCalled();
  });
});
