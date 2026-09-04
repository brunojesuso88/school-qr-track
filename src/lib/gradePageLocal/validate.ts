/**
 * Validação determinística da leitura local + score de confiança.
 *
 * Separa sinais BLOQUEANTES (risco real de nota errada) de AVISOS informativos
 * (ex.: disciplina da matriz sem nota no boletim). Somente bloqueantes impedem
 * que a leitura local seja considerada AUTORITATIVA.
 */
import { normalizeText } from './normalize';
import { buildSubjectAnchors, matchSubjectAnchor } from './subjectAnchors';
import { GridLayout, LocalCell, LocalExpectedSubject, LocalValidation, TextToken } from './types';

export interface ValidateInput {
  tokens: TextToken[];
  grid: GridLayout | null;
  cells: LocalCell[];
  subjects: string[];
  expectedSubjects: LocalExpectedSubject[];
  ambiguousCells: number;
  /** Tokens fora das colunas conhecidas que PARECEM nota (risco real). */
  orphanGradeTokens?: number;
  /** Tokens fora das colunas conhecidas que não são nota (ruído). */
  orphanTokens: number;
  studentName: string | null;
  matchScore: number;
}

export const MIN_GRID_TOKENS = 40;
export const SUBJECT_COVERAGE_CONCLUSIVE = 0.5;
export const SUBJECT_COVERAGE_CONFIDENT = 0.8;
export const MATCH_SCORE_CONFIDENT = 0.95;
/** Confiança mínima por célula numérica para a página ser autoritativa. */
export const CELL_CONFIDENCE_AUTHORITATIVE = 0.95;

const BLOCKER_MESSAGES: Record<string, string> = {
  grid_missing: 'Estrutura da grade não reconhecida no texto da página',
  insufficient_text: 'Página com pouco texto extraível (possível PDF digitalizado)',
  periods_missing: 'Nenhum período reconhecido',
  subject_rows_missing: 'Nenhuma linha de disciplina reconhecida',
  invalid_value: 'Valor inválido lido na página',
  out_of_scale: 'Nota fora da escala 0–10',
  conflicting_duplicate: 'Duplicidade conflitante entre células',
  ambiguous_geometry: 'Célula ambígua por geometria da página',
  orphan_grade_tokens: 'Valor com aparência de nota fora das colunas conhecidas',
  low_confidence_grade: 'Célula de nota com baixa confiança',
  student_unmatched_or_ambiguous: 'Aluno não identificado com segurança na turma',
};

const ADVISORY_MESSAGES: Record<string, string> = {
  matrix_partial_coverage: 'Disciplinas lidas não reconhecidas na matriz da turma',
  expected_subject_without_grade: 'Disciplinas da matriz sem notas lançadas no boletim',
  subheader_missing: 'Subcolunas Nota/Faltas não identificadas (geometria das colunas resolvida)',
  unknown_period: 'Coluna de período não classificada',
  orphan_tokens: 'Tokens fora das colunas conhecidas que não são notas',
};

export function validateLocalPage(input: ValidateInput): LocalValidation {
  const blockers: string[] = [];
  const advisories: string[] = [];
  const detail: string[] = [];
  const {
    tokens, grid, cells, subjects, expectedSubjects, ambiguousCells,
    orphanGradeTokens = 0, orphanTokens, studentName, matchScore,
  } = input;

  const build = (): LocalValidation => {
    const uniqueBlockers = [...new Set(blockers)];
    const uniqueAdvisories = [...new Set(advisories)];
    const reasons = [
      ...uniqueBlockers.map((c) => BLOCKER_MESSAGES[c] ?? c),
      ...uniqueAdvisories.map((c) => ADVISORY_MESSAGES[c] ?? c),
      ...detail,
    ];
    return {
      conclusive: false, score: 0, reasons: [...new Set(reasons)],
      blockers: uniqueBlockers, advisories: uniqueAdvisories,
    };
  };

  if (!grid) {
    blockers.push('grid_missing');
    return build();
  }
  if (tokens.length < MIN_GRID_TOKENS) blockers.push('insufficient_text');
  if (grid.columns.length === 0) blockers.push('periods_missing');
  if (grid.columns.some((c) => c.kind === 'unknown')) advisories.push('unknown_period');
  if (grid.subHeaderLineIndex == null) advisories.push('subheader_missing');
  if (subjects.length === 0) blockers.push('subject_rows_missing');

  const uniqueSubjects = new Set(subjects.map((s) => normalizeText(s)));
  // Cobertura por identidade canônica (nome/alias/abreviação), não por igualdade bruta de string.
  const anchors = buildSubjectAnchors(expectedSubjects);
  const matchedCanonical = new Set<string>();
  let unrecognized = 0;
  uniqueSubjects.forEach((norm) => {
    const match = matchSubjectAnchor(norm, anchors);
    if (match) matchedCanonical.add(normalizeText(match.anchor.canonical));
    else unrecognized++;
  });
  const expectedCoverage = expectedSubjects.length > 0 ? matchedCanonical.size / expectedSubjects.length : 1;
  const recognition = uniqueSubjects.size > 0 ? matchedCanonical.size / uniqueSubjects.size : 1;
  // Disciplinas esperadas ausentes do boletim NÃO são erro de leitura (apenas aviso).
  const coverage = expectedSubjects.length > 0 ? Math.max(expectedCoverage, recognition) : 1;
  if (expectedSubjects.length > 0 && recognition < SUBJECT_COVERAGE_CONFIDENT) {
    advisories.push('matrix_partial_coverage');
    detail.push(`Disciplinas lidas não reconhecidas na matriz da turma (${unrecognized}/${uniqueSubjects.size})`);
  }
  if (expectedSubjects.length > 0 && expectedCoverage < 1) advisories.push('expected_subject_without_grade');
  if (ambiguousCells > 0) {
    blockers.push('ambiguous_geometry');
    detail.push(`${ambiguousCells} célula(s) ambígua(s) por geometria`);
  }
  if (orphanGradeTokens > 0) {
    blockers.push('orphan_grade_tokens');
    detail.push(`${orphanGradeTokens} valor(es) de nota fora das colunas conhecidas`);
  }
  if (orphanTokens > 0) advisories.push('orphan_tokens');

  const invalid = cells.filter((c) => c.invalid).length;
  if (invalid > 0) {
    blockers.push('invalid_value');
    detail.push(`${invalid} valor(es) inválido(s)`);
  }
  const outOfScale = cells.filter((c) => c.value != null && (c.value < 0 || c.value > 10)).length;
  if (outOfScale > 0) blockers.push('out_of_scale');

  const lowConfidence = cells.filter((c) => c.value != null && c.confidence < CELL_CONFIDENCE_AUTHORITATIVE).length;
  if (lowConfidence > 0) {
    blockers.push('low_confidence_grade');
    detail.push(`${lowConfidence} nota(s) com confiança abaixo de ${Math.round(CELL_CONFIDENCE_AUTHORITATIVE * 100)}%`);
  }

  const seen = new Map<string, string | null>();
  let conflictingDuplicates = 0;
  cells.forEach((c) => {
    const key = `${canonicalSubjectKey(c.subject)}||${normalizeText(c.period)}`;
    if (seen.has(key)) { if (seen.get(key) !== c.raw_value) conflictingDuplicates++; }
    else seen.set(key, c.raw_value);
  });
  if (conflictingDuplicates > 0) blockers.push('conflicting_duplicate');

  if (!studentName) {
    blockers.push('student_unmatched_or_ambiguous');
    detail.push('Aluno não identificado no cabeçalho');
  } else if (matchScore < MATCH_SCORE_CONFIDENT) {
    blockers.push('student_unmatched_or_ambiguous');
    detail.push('Aluno não casado com certeza na turma');
  }

  // Conclusivo = a estrutura foi reconstruída de forma utilizável (mesmo que precise de IA).
  const conclusive = grid.columns.length > 0 && subjects.length > 0 &&
    coverage >= SUBJECT_COVERAGE_CONCLUSIVE && tokens.length >= MIN_GRID_TOKENS;

  const penalty = Math.min(1, (ambiguousCells * 0.05) + (invalid * 0.1) + (orphanTokens * 0.02) +
    (orphanGradeTokens * 0.1) + (outOfScale * 0.1) + (conflictingDuplicates * 0.1) +
    (1 - Math.min(1, coverage)) * 0.4);
  const score = conclusive ? Math.max(0, Math.min(1, 1 - penalty)) : 0;

  const base = build();
  return { ...base, conclusive, score };
}

/**
 * Leitura local AUTORITATIVA: conclusiva e sem nenhum sinal bloqueante.
 * Avisos (matriz parcial, disciplina sem nota, subheader imperfeito) NÃO derrubam a autoridade.
 */
export const isLocalAuthoritative = (v: LocalValidation) =>
  v.conclusive && (v.blockers ?? []).length === 0;

/** Compatibilidade: "confiante" passa a significar "autoritativa". */
export const isLocallyConfident = isLocalAuthoritative;
