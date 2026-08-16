import { describe, expect, it } from 'vitest';
import { buildSubjectAnchors, matchSubjectAnchor } from '../subjectAnchors';
import { buildEffectiveSubjectMatrix } from '../effectiveMatrix';

const anchors = buildSubjectAnchors([
  { name: 'Língua Portuguesa', aliases: ['PORTUGUES', 'LÍNGUA PORTUGUESA I'], abbreviation: 'LP' },
  { name: 'Matemática', aliases: [], abbreviation: 'MAT' },
  { name: 'Aprofundamento IF - CNS - I', aliases: ['Aprfl'], abbreviation: null },
]);

describe('âncoras de disciplina', () => {
  it('reconhece por igualdade, alias e abreviação', () => {
    expect(matchSubjectAnchor('LINGUA PORTUGUESA', anchors)?.kind).toBe('exact');
    expect(matchSubjectAnchor('portugues', anchors)?.anchor.canonical).toBe('Língua Portuguesa');
    expect(matchSubjectAnchor('MAT', anchors)?.kind).toBe('abbreviation');
    expect(matchSubjectAnchor('Aprfl', anchors)?.anchor.canonical).toBe('Aprofundamento IF - CNS - I');
  });

  it('não ancora texto que não pertence à matriz', () => {
    expect(matchSubjectAnchor('Total de faltas', anchors)).toBeNull();
    expect(matchSubjectAnchor('xyz', anchors)).toBeNull();
  });

  it('tolera pequenas diferenças de grafia', () => {
    expect(matchSubjectAnchor('Matematica', anchors)?.anchor.canonical).toBe('Matemática');
  });
});

describe('matriz efetiva', () => {
  it('une mapeamento, importadas e catálogo da série, e herda aliases', () => {
    const matrix = buildEffectiveSubjectMatrix({
      mapping: [{ name: 'Língua Portuguesa', weekly_classes: 4 }],
      imported: [{ name: 'Matemática', weekly_classes: 4 }],
      catalog: [
        { name: 'Língua Portuguesa', aliases: ['PORTUGUES'], abbreviation: 'LP', series: ['1º ano'] },
        { name: 'Filosofia', series: ['1º ano'], default_weekly_classes: 1 },
        { name: 'Sociologia', series: ['3º ano'], default_weekly_classes: 1 },
      ],
      series: '1º ano',
    });
    const names = matrix.map((m) => m.name).sort();
    expect(names).toEqual(['Filosofia', 'Language'.slice(0, 0) + 'Língua Portuguesa', 'Matemática']);
    expect(matrix.find((m) => m.name === 'Língua Portuguesa')?.aliases).toContain('PORTUGUES');
  });
});