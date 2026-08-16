/** Validação determinística da leitura local + score de confiança (critérios da Fase 2). */
import { normalizeText } from './normalize';
import { GridLayout, LocalCell, LocalValidation, TextToken } from './types';

export interface ValidateInput {
  tokens: TextToken[];
  grid: GridLayout | null;
  cells: LocalCell[];
  subjects: string[];
  expectedSubjects: { name: string }[];
  ambiguousCells: number;
  orphanTokens: number;
  studentName: string | null;
  matchScore: number;
}

export const MIN_GRID_TOKENS = 40;
export const SUBJECT_COVERAGE_CONCLUSIVE = 0.5;
export const SUBJECT_COVERAGE_CONFIDENT = 0.8;
export const MATCH_SCORE_CONFIDENT = 0.95;

export function validateLocalPage(input: ValidateInput): LocalValidation {
  const reasons: string[] = [];
  const {
    tokens, grid, cells, subjects, expectedSubjects, ambiguousCells, orphanTokens, studentName, matchScore,
  } = input;

  if (!grid) {
    return { conclusive: false, score: 0, reasons: ['Estrutura da grade não reconhecida no texto da página'] };
  }
  if (tokens.length < MIN_GRID_TOKENS) {
    reasons.push('Página com pouco texto extraível (possível PDF digitalizado)');
  }
  if (grid.columns.length === 0) reasons.push('Nenhum período reconhecido');
  if (grid.columns.some((c) => c.kind === 'unknown')) reasons.push('Período não classificado');
  if (grid.subHeaderLineIndex == null) reasons.push('Subcolunas Nota/Faltas não identificadas');
  if (subjects.length === 0) reasons.push('Nenhuma linha de disciplina reconhecida');

  const uniqueSubjects = new Set(subjects.map((s) => normalizeText(s)));
  const coverage = expectedSubjects.length > 0 ? uniqueSubjects.size / expectedSubjects.length : 1;
  if (expectedSubjects.length > 0 && coverage < SUBJECT_COVERAGE_CONFIDENT) {
    reasons.push(`Disciplinas lidas abaixo do esperado (${uniqueSubjects.size}/${expectedSubjects.length})`);
  }
  if (ambiguousCells > 0) reasons.push(`${ambiguousCells} célula(s) ambígua(s) por geometria`);
  if (orphanTokens > 0) reasons.push(`${orphanTokens} valor(es) fora das colunas conhecidas`);

  const invalid = cells.filter((c) => c.invalid).length;
  if (invalid > 0) reasons.push(`${invalid} valor(es) inválido(s)`);
  const outOfScale = cells.filter((c) => c.value != null && (c.value < 0 || c.value > 10)).length;
  if (outOfScale > 0) reasons.push(`${outOfScale} nota(s) fora da escala 0–10`);

  const seen = new Map<string, string | null>();
  let conflictingDuplicates = 0;
  cells.forEach((c) => {
    const key = `${normalizeText(c.subject)}||${normalizeText(c.period)}`;
    if (seen.has(key)) { if (seen.get(key) !== c.raw_value) conflictingDuplicates++; }
    else seen.set(key, c.raw_value);
  });
  if (conflictingDuplicates > 0) reasons.push('Duplicidade conflitante entre células');

  if (!studentName) reasons.push('Aluno não identificado no cabeçalho');
  else if (matchScore < MATCH_SCORE_CONFIDENT) reasons.push('Aluno não casado com certeza na turma');

  // Conclusivo = a estrutura foi reconstruída de forma utilizável (mesmo que precise de IA).
  const conclusive = Boolean(grid) && grid.columns.length > 0 && subjects.length > 0 &&
    coverage >= SUBJECT_COVERAGE_CONCLUSIVE && tokens.length >= MIN_GRID_TOKENS;

  const penalty = Math.min(1, (ambiguousCells * 0.05) + (invalid * 0.1) + (orphanTokens * 0.02) +
    (outOfScale * 0.1) + (conflictingDuplicates * 0.1) + (1 - Math.min(1, coverage)) * 0.4);
  const score = conclusive ? Math.max(0, Math.min(1, 1 - penalty)) : 0;

  return { conclusive, score, reasons: [...new Set(reasons)] };
}

/** A leitura local dispensa IA somente quando não sobrou nenhum motivo de dúvida. */
export const isLocallyConfident = (v: LocalValidation) => v.conclusive && v.reasons.length === 0 && v.score >= 0.95;