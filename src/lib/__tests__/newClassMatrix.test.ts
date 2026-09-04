/**
 * NOVA TURMA: SÉRIE => MATRIZ CORRESPONDENTE DA ESCOLA ATIVA.
 *
 * Regra pura testada aqui (`selectMatrixForSeries`):
 * - 1 matriz com componentes na série  => aplicada por padrão;
 * - várias                             => usuário escolhe (nunca escolhemos em silêncio);
 * - nenhuma                            => criação da turma segue liberada, sem matriz.
 *
 * A lista de matrizes SEMPRE vem de `fetchSchoolMatrices(school_id da escola ativa)`
 * e a contagem por série de `curriculum_matrix_subjects` filtrada por `school_id`:
 * matriz de outra escola nunca aparece como candidata.
 */
import { describe, expect, it } from 'vitest';
import { CurriculumMatrixRecord, selectMatrixForSeries } from '@/lib/curriculumMatrices';

const matrix = (id: string, name: string, school = 'escola-a'): CurriculumMatrixRecord => ({
  id,
  school_id: school,
  name,
  description: null,
  is_original: name === 'Matriz Original',
  system_key: name === 'Matriz Integral' ? 'integral' : null,
  components: 0,
});

describe('matriz correspondente na criação da turma', () => {
  it('uma única matriz compatível é aplicada por padrão', () => {
    const r = selectMatrixForSeries(
      [matrix('m1', 'Matriz Original'), matrix('m2', 'Matriz Integral')],
      { m1: 16 },
    );
    expect(r.matrixId).toBe('m1');
    expect(r.autoApply).toBe(true);
    expect(r.needsChoice).toBe(false);
    expect(r.candidates.map((m) => m.name)).toEqual(['Matriz Original']);
  });

  it('série sem matriz => nenhuma seleção e criação liberada', () => {
    const r = selectMatrixForSeries([matrix('m1', 'Matriz Original')], {});
    expect(r.candidates).toHaveLength(0);
    expect(r.matrixId).toBeNull();
    expect(r.autoApply).toBe(false);
    expect(r.needsChoice).toBe(false);
  });

  it('várias matrizes => exige escolha e nunca decide sozinho', () => {
    const r = selectMatrixForSeries(
      [matrix('m1', 'Matriz Original'), matrix('m2', 'Matriz Integral'), matrix('m3', 'Matriz 2027')],
      { m1: 16, m2: 23 },
    );
    expect(r.needsChoice).toBe(true);
    expect(r.matrixId).toBeNull();
    expect(r.autoApply).toBe(false);
    expect(r.candidates.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('escola A nunca enxerga matriz da escola B com o mesmo nome/série', () => {
    // A consulta já é filtrada por escola: aqui só entram matrizes da escola ativa.
    const doEscolaA = [matrix('a1', 'Matriz Original', 'escola-a')];
    const r = selectMatrixForSeries(doEscolaA, { a1: 16, b1: 16 });
    expect(r.candidates.map((m) => m.school_id)).toEqual(['escola-a']);
    expect(r.matrixId).toBe('a1');
  });
});
