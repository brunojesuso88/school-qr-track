/**
 * Matriz Integral: componentes SEM carga semanal nunca ganham uma carga
 * fictícia. Proibido `?? 1` em runtime — nem para criar/atualizar a camada
 * auxiliar `mapping_class_subjects`, nem para a participação no IRA.
 */
import { describe, expect, it } from 'vitest';
import { planClassCurriculumSync } from '../plan';
import { resolveIncludeInIra } from '../includeInIra';
import { CurriculumMatrixItem } from '@/lib/curriculumMatrixCore';

const integralItem = (name: string, slot = 1): CurriculumMatrixItem => ({
  name,
  abbreviation: null,
  aliases: [],
  weekly_classes: null,
  include_in_ira: true,
  slot_index: slot,
} as CurriculumMatrixItem);

describe('componentes da Integral sem carga semanal', () => {
  it('não cria nem atualiza mapping_class_subjects, mas cria grade_subject com carga null', () => {
    const plan = planClassCurriculumSync({
      matrix: [integralItem('CRIATIVIDADE E INOVACAO NO EMPREENDEDORISMO')],
      mappingSubjects: [],
      gradeSubjects: [],
      manageMapping: true,
    });
    expect(plan.mappingCreate).toHaveLength(0);
    expect(plan.mappingUpdate).toHaveLength(0);
    expect(plan.gradeCreate).toHaveLength(1);
    expect(plan.gradeCreate[0].weekly_classes).toBeNull();
    expect(plan.gradeCreate[0].include_in_ira).toBe(true);
  });

  it('mapping existente com carga legada não é sobrescrito por valor fictício', () => {
    const plan = planClassCurriculumSync({
      matrix: [integralItem('DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS')],
      mappingSubjects: [
        { id: 'm1', subject_name: 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS', weekly_classes: 3 },
      ],
      gradeSubjects: [],
      manageMapping: true,
    });
    expect(plan.mappingCreate).toHaveLength(0);
    expect(plan.mappingUpdate).toHaveLength(0);
  });

  it('matriz ponderada continua criando o mapping com a carga real', () => {
    const plan = planClassCurriculumSync({
      matrix: [{ ...integralItem('MATEMATICA'), weekly_classes: 4 } as CurriculumMatrixItem],
      mappingSubjects: [],
      gradeSubjects: [],
      manageMapping: true,
    });
    expect(plan.mappingCreate).toEqual([{ subject_name: 'MATEMATICA', weekly_classes: 4 }]);
  });

  it('duas ocorrências do mesmo componente geram dois grade_subjects (slots 1 e 2)', () => {
    const name = 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS';
    const plan = planClassCurriculumSync({
      matrix: [integralItem(name, 1), integralItem(name, 2)],
      mappingSubjects: [],
      gradeSubjects: [],
      manageMapping: true,
    });
    expect(plan.gradeCreate.map((g) => g.slot_index)).toEqual([1, 2]);
    expect(plan.mappingCreate).toHaveLength(0);
  });
});

describe('participação no IRA ao importar boletim', () => {
  it('regra 1/2/4 é a MESMA para toda matriz (Integral inclusive)', () => {
    expect(resolveIncludeInIra({ weeklyClasses: 4 })).toBe(true);
    expect(resolveIncludeInIra({ weeklyClasses: 3 })).toBe(false);
    expect(resolveIncludeInIra({ weeklyClasses: null })).toBe(false);
    // Carga 0 da Matriz Integral = "não informada": não entra automaticamente.
    expect(resolveIncludeInIra({ weeklyClasses: 0 })).toBe(false);
  });

  it('definição da matriz vence a regra de carga (Integral semeia participando)', () => {
    expect(resolveIncludeInIra({ matrixIncludeInIra: false, weeklyClasses: 4 })).toBe(false);
    expect(resolveIncludeInIra({ matrixIncludeInIra: true, weeklyClasses: 0 })).toBe(true);
  });

  it('escolha já registrada pelo usuário nunca é sobrescrita', () => {
    expect(resolveIncludeInIra({ previous: false, matrixIncludeInIra: true, weeklyClasses: 0 })).toBe(false);
    expect(resolveIncludeInIra({ previous: true, weeklyClasses: 3 })).toBe(true);
  });
});
