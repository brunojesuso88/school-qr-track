/** Camada de decisão automática por página (acima da confirmação manual). Nada aqui grava dados. */
import { ReviewRow } from './GradesReviewTable';
import { DetectedStudent, RegistrationDecision } from './gradesConflicts';

/** Exceções configuráveis por sessão. Padrão: nenhuma exceção. */
export interface AutoAcceptRules {
  /** Divergência cadastral deixa de bloquear e passa a "Atualizar pelo boletim". */
  use_pdf_registry: boolean;
  /** Nome semelhante (>= 0,85) com candidato ÚNICO é vinculado automaticamente. */
  accept_unique_fuzzy: boolean;
}

export const DEFAULT_AUTO_ACCEPT_RULES: AutoAcceptRules = {
  use_pdf_registry: false,
  accept_unique_fuzzy: false,
};

/** Lê as regras persistidas na sessão de forma tolerante a sessões antigas. */
export const parseAutoAcceptRules = (value: unknown): AutoAcceptRules => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    use_pdf_registry: raw.use_pdf_registry === true,
    accept_unique_fuzzy: raw.accept_unique_fuzzy === true,
  };
};

/** Flags de célula que impedem a autoaceitação. Célula vazia NUNCA é erro. */
const BLOCKING_CELL_FLAGS = [
  'invalid_value',
  'out_of_scale',
  'low_confidence',
  'reconciliation_divergence',
  'conflicting_duplicate',
  'unmatched_student',
  'missing_subject',
];

export interface AutoAcceptInput {
  detected: DetectedStudent;
  rows: ReviewRow[];
  classDecisionPending: boolean;
  pageHasExistingGrades: boolean;
  linkedStudentId: string | null;
  suggestedStudentId: string | null;
  regDecision: RegistrationDecision | null;
  /** Exceções permitidas (padrão: nenhuma). */
  rules?: AutoAcceptRules;
  /** Somente admin/direção podem aplicar a exceção cadastral. */
  canUsePdfRegistry?: boolean;
  /** Aluno encontrado em outra turma — sempre bloqueia. */
  otherClassMatch?: boolean;
  /** Contexto de turma vazio/inconsistente — sempre bloqueia. */
  contextBlocked?: boolean;
}

export interface AutoAcceptResult {
  eligible: boolean;
  reasons: string[];
  /** Exceções efetivamente aplicadas nesta página. */
  appliedExceptions: string[];
}

/** Regra ESTRITA: só é elegível quando não há nenhum problema pendente na página. */
export const evaluateAutoAccept = (input: AutoAcceptInput): AutoAcceptResult => {
  const {
    detected, rows, classDecisionPending, pageHasExistingGrades,
    linkedStudentId, suggestedStudentId, regDecision,
    rules = DEFAULT_AUTO_ACCEPT_RULES,
    canUsePdfRegistry = false,
    otherClassMatch = false,
    contextBlocked = false,
  } = input;
  const reasons: string[] = [];
  const applied: string[] = [];
  const registryExceptionOn = rules.use_pdf_registry && canUsePdfRegistry;
  const fuzzyExceptionOn = rules.accept_unique_fuzzy;

  if (classDecisionPending) reasons.push('Turma do PDF diferente da turma selecionada');
  if (otherClassMatch) reasons.push('Aluno encontrado em outra turma');
  if (contextBlocked) reasons.push('Contexto da turma vazio ou inconsistente');

  if (!linkedStudentId || linkedStudentId !== suggestedStudentId) {
    reasons.push('Aluno da página ainda não vinculado automaticamente');
  }
  if (detected.status === 'unmatched') {
    reasons.push('Aluno não identificado na turma');
  } else if (detected.status === 'fuzzy') {
    // Exceção B: só vale com candidato ÚNICO por semelhança (o parser já garante isso).
    if (fuzzyExceptionOn && detected.match_score >= 0.85) applied.push('Nome semelhante com candidato único');
    else reasons.push('Aluno identificado apenas por semelhança de nome');
  }
  if (detected.conflicts.includes('ambiguous_match') || detected.conflicts.includes('duplicate_link')) {
    reasons.push('Aluno ambíguo ou homônimo na turma');
  }
  const otherConflicts = detected.conflicts.filter((c) => ![
    'ambiguous_match', 'name_similar', 'code_mismatch', 'birth_date_mismatch',
    'mother_mismatch', 'father_mismatch', 'duplicate_link',
  ].includes(c));
  if (otherConflicts.length > 0) reasons.push('Conflitos de aluno pendentes');
  const registryConflicts = detected.conflicts.filter((c) =>
    ['code_mismatch', 'birth_date_mismatch', 'mother_mismatch', 'father_mismatch'].includes(c));
  if (registryConflicts.length > 0 && !registryExceptionOn) {
    reasons.push(detected.status === 'unmatched'
      ? 'Aluno não identificado na turma'
      : 'Dados cadastrais divergentes do boletim');
  }

  // Notas idênticas já gravadas NÃO são pendência; só divergências reais bloqueiam.
  if (pageHasExistingGrades) reasons.push('Nota existente diverge da nota do PDF (aluno + disciplina + período)');

  const flagged = new Set<string>();
  rows.forEach((r) => (r.flags || []).forEach((f) => { if (BLOCKING_CELL_FLAGS.includes(f)) flagged.add(f); }));
  if (flagged.has('invalid_value')) reasons.push('Nota inválida na página');
  if (flagged.has('out_of_scale')) reasons.push('Nota fora da escala 0–10');
  if (flagged.has('low_confidence')) reasons.push('Célula com baixa confiança');
  if (flagged.has('reconciliation_divergence')) reasons.push('Divergência entre leituras');
  if (flagged.has('conflicting_duplicate')) reasons.push('Duplicidade conflitante');
  if (flagged.has('missing_subject')) reasons.push('Disciplina ausente');
  if (flagged.has('unmatched_student')) reasons.push('Aluno não identificado na turma');

  if (rows.some((r) => r.value != null && (r.value < 0 || r.value > 10))) {
    reasons.push('Nota fora da escala 0–10');
  }

  // Divergência cadastral crítica: só é seguro quando o cadastro está vazio (preenchimento seguro).
  const critical = (pdfValue: string | null, current: string | null, label: string) => {
    if (!pdfValue) return;
    if (current && pdfValue.trim().toLocaleLowerCase('pt-BR') !== current.trim().toLocaleLowerCase('pt-BR')) {
      reasons.push(`Divergência cadastral: ${label}`);
    }
  };
  if (registryExceptionOn) {
    applied.push('Dados cadastrais do boletim aplicados automaticamente');
  } else if (regDecision) {
    critical(detected.pdf_code, detected.current?.school_code ?? null, 'Código');
    critical(detected.pdf_birth_date, detected.current?.birth_date ?? null, 'data de nascimento');
    critical(detected.pdf_mother_name, detected.current?.mother_name ?? null, 'nome da mãe');
    critical(detected.pdf_father_name, detected.current?.father_name ?? null, 'nome do pai');
  }

  const unique = [...new Set(reasons)];
  return { eligible: unique.length === 0, reasons: unique, appliedExceptions: [...new Set(applied)] };
};
