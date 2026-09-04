/**
 * Regra de página SEM DISCIPLINAS (boletins multipágina por aluno).
 *
 * Boletins da Matriz Integral (e eventualmente de outras matrizes) podem usar
 * MAIS DE UMA PÁGINA para o mesmo aluno: página de notas, página de continuação/
 * observação e novamente página de notas. Quando a leitura LOCAL (com as âncoras
 * da matriz efetiva da turma) não reconhece NENHUMA disciplina na página, essa
 * página é apenas continuação/cabeçalho: deve ser IGNORADA em silêncio, sem IA,
 * sem gravar disciplina, nota, conflito ou placeholder.
 *
 * Não é ignorada a página que:
 *  - tem ao menos uma disciplina reconhecida (mesmo com todos os períodos vazios);
 *  - não tem texto extraível (possível PDF digitalizado — segue o fluxo normal);
 *  - traz valores com aparência de nota fora de qualquer linha de disciplina
 *    (sinal de falha de leitura, não de página vazia).
 */
import { TextToken } from './types';

const GRADE_LIKE = /^\d{1,2}([.,]\d{1,2})?$/;

export const countGradeLikeTokens = (tokens: TextToken[]) =>
  tokens.filter((t) => GRADE_LIKE.test(String(t?.text ?? '').trim())).length;

export interface SkipPageDecision {
  skip: boolean;
  /** Diagnóstico não bloqueante exibido/registrado quando a página é ignorada. */
  note: string | null;
}

export function decideSkipPageWithoutSubjects(input: {
  page: number;
  tokens: TextToken[];
  subjectCount: number;
  gridDetected: boolean;
  orphanGradeTokens?: number;
}): SkipPageDecision {
  const { page, tokens, subjectCount, gridDetected, orphanGradeTokens = 0 } = input;
  if (subjectCount > 0) return { skip: false, note: null };
  if (tokens.length === 0) return { skip: false, note: null };
  const gradeLike = gridDetected ? orphanGradeTokens : countGradeLikeTokens(tokens);
  if (gradeLike > 0) return { skip: false, note: null };
  return { skip: true, note: `Página ${page} ignorada: nenhuma disciplina encontrada` };
}
