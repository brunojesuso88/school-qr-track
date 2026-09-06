/**
 * ABA IRA — CAMPO DE PESO JÁ PREENCHIDO COM O PADRÃO DA DISCIPLINA.
 *
 * Regras verificadas:
 *  - sem override, o input mostra o `ira_weight` da matriz (FGB 2 / MAT 4 / LP 4 / IF 1);
 *  - com override, o input mostra o valor personalizado da turma;
 *  - digitar exatamente o peso base limpa o override (volta a herdar a matriz);
 *  - a carga semanal NUNCA preenche nem calcula peso.
 */
import { describe, expect, it } from 'vitest';
import { customWeightPatch, defaultIraWeight, resolveWeight, weightInputValue } from '@/lib/ira';

describe('valor exibido no campo de peso', () => {
  it('sem override mostra o peso base da matriz', () => {
    expect(weightInputValue({ iraWeight: defaultIraWeight('fgb', 'FÍSICA'), customWeight: null })).toBe('2');
    expect(weightInputValue({ iraWeight: defaultIraWeight('fgb', 'MATEMÁTICA'), customWeight: null })).toBe('4');
    expect(weightInputValue({ iraWeight: defaultIraWeight('fgb', 'LÍNGUA PORTUGUESA'), customWeight: null })).toBe('4');
    expect(weightInputValue({ iraWeight: defaultIraWeight('itinerario', 'PROJETO DE VIDA'), customWeight: null })).toBe('1');
  });

  it('com override mostra o peso personalizado da turma', () => {
    expect(weightInputValue({ iraWeight: 4, customWeight: 1 })).toBe('1');
  });

  it('sem peso base configurado o campo fica vazio (pendente), nunca derivado da carga', () => {
    expect(weightInputValue({ iraWeight: null, customWeight: null })).toBe('');
  });
});

describe('gravação do override', () => {
  it('valor diferente do base vira override da turma', () => {
    expect(customWeightPatch({ iraWeight: 4, input: '2' })).toEqual({ custom_ira_weight: 2 });
  });

  it('voltar ao peso base limpa o override', () => {
    expect(customWeightPatch({ iraWeight: 4, input: '4' })).toEqual({ custom_ira_weight: null });
  });

  it('campo vazio limpa o override', () => {
    expect(customWeightPatch({ iraWeight: 2, input: '' })).toEqual({ custom_ira_weight: null });
  });
});

describe('carga semanal não influencia o peso', () => {
  it('ira_weight divergente da carga: vale o ira_weight', () => {
    // carga 4, peso da matriz 1 => peso 1.
    expect(resolveWeight({ iraWeight: 1, customWeight: null })).toEqual({ weight: 1, source: 'matrix' });
  });

  it('ira_weight nulo com carga 4 NÃO vira peso 4: fica pendente', () => {
    expect(resolveWeight({ iraWeight: null, customWeight: null })).toEqual({ weight: null, source: 'none' });
    expect(weightInputValue({ iraWeight: null, customWeight: null })).toBe('');
  });
});
