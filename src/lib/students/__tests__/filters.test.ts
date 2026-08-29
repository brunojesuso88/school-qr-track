import { describe, expect, it } from 'vitest';
import { classOptionsForShift, hasMedals, isClassValidForShift } from '../filters';

const classes = [
  { name: '1ANO-A', shift: 'morning' },
  { name: '2ANO-B', shift: 'afternoon' },
  { name: '3ANO-C', shift: 'evening' },
  { name: '1ANO-D', shift: 'morning' },
];

const students = [
  { class: '1ANO-A', shift: 'morning' },
  { class: 'TURMA-LEGADO', shift: 'afternoon' },
  { class: '', shift: 'morning' },
];

describe('filtro dependente Turno -> Turma', () => {
  it('lista apenas turmas do turno selecionado', () => {
    expect(classOptionsForShift(classes, students, 'morning')).toEqual(['1ANO-A', '1ANO-D']);
    expect(classOptionsForShift(classes, students, 'evening')).toEqual(['3ANO-C']);
  });

  it('inclui turmas sem cadastro canônico usando o turno do aluno', () => {
    expect(classOptionsForShift(classes, students, 'afternoon')).toEqual(['2ANO-B', 'TURMA-LEGADO']);
  });

  it('com turno "all" lista todas as turmas, em ordem alfabética e sem vazios', () => {
    expect(classOptionsForShift(classes, students, 'all')).toEqual([
      '1ANO-A', '1ANO-D', '2ANO-B', '3ANO-C', 'TURMA-LEGADO',
    ]);
  });

  it('não duplica turma presente na fonte canônica e nos alunos', () => {
    const opts = classOptionsForShift(classes, students, 'morning');
    expect(opts.filter((c) => c === '1ANO-A')).toHaveLength(1);
  });

  it('valida se a turma selecionada pertence ao novo turno', () => {
    expect(isClassValidForShift(classes, students, 'morning', '1ANO-A')).toBe(true);
    expect(isClassValidForShift(classes, students, 'afternoon', '1ANO-A')).toBe(false);
    expect(isClassValidForShift(classes, students, 'afternoon', 'all')).toBe(true);
    expect(isClassValidForShift(classes, students, 'all', '3ANO-C')).toBe(true);
  });
});

describe('filtro somente alunos com medalhas', () => {
  const medals = { a: [{ area: 'math' }], b: [], c: [{ area: 'x' }, { area: 'y' }] } as Record<string, unknown[]>;

  it('mantém apenas alunos com pelo menos uma condecoração', () => {
    expect(['a', 'b', 'c', 'd'].filter((id) => hasMedals(medals, id))).toEqual(['a', 'c']);
  });

  it('retorna false para aluno sem entrada no mapa', () => {
    expect(hasMedals(medals, 'inexistente')).toBe(false);
  });

  it('combina com outros filtros sem alterar o universo do cálculo', () => {
    const base = [
      { id: 'a', class: '1ANO-A', shift: 'morning' },
      { id: 'b', class: '1ANO-A', shift: 'morning' },
      { id: 'c', class: '2ANO-B', shift: 'afternoon' },
    ];
    // base (turno manhã) alimenta o cálculo; medalha só filtra exibição
    const baseFiltered = base.filter((s) => s.shift === 'morning');
    expect(baseFiltered.map((s) => s.id)).toEqual(['a', 'b']);
    expect(baseFiltered.filter((s) => hasMedals(medals, s.id)).map((s) => s.id)).toEqual(['a']);
  });
});
