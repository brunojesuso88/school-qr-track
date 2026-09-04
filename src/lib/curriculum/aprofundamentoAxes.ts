/**
 * FONTE ÚNICA DA VERDADE dos eixos de Aprofundamento IF.
 *
 * O boletim traz o eixo no meio do nome (`APROFUNDAMENTO IF - SEA - I`), mas o
 * catálogo só possui duas disciplinas canônicas: `APROFUNDAMENTO IF - I` e
 * `APROFUNDAMENTO IF - II`. A lista de eixos é EXPLÍCITA de propósito: nenhuma
 * palavra arbitrária pode ser tratada como eixo.
 *
 * Este módulo não importa nada do projeto (evita ciclo de dependências) e é
 * consumido por `gradePageLocal/normalize.ts` e por `curriculumMatrixData.ts`.
 */
export const APROFUNDAMENTO_AXES = ['CHL', 'CNS', 'ETT', 'SEA'] as const;

export type AprofundamentoAxis = (typeof APROFUNDAMENTO_AXES)[number];

/** Regex de eixo (já em minúsculas, para uso após normalização). */
export const AXIS_WORD_REGEX = new RegExp(
  `\\b(${APROFUNDAMENTO_AXES.map((a) => a.toLowerCase()).join('|')})\\b`,
  'g',
);

/** Aliases oficiais dos Aprofundamentos (`I`/`II`) para todos os eixos. */
export const aprofundamentoAliases = (roman: 'I' | 'II'): string[] =>
  APROFUNDAMENTO_AXES.flatMap((axis) => [
    `APROFUNDAMENTO IF - ${axis} - ${roman}`,
    `APROFUNDAMENTO IF ${axis} ${roman}`,
  ]);
