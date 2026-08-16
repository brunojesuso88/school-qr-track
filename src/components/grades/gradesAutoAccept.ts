/** Camada de decisão automática por página (acima da confirmação manual). Nada aqui grava dados. */
import { ReviewRow } from './GradesReviewTable';
import { DetectedStudent, RegistrationDecision } from './gradesConflicts';
import { matchesSecondPass } from '@/lib/gradePageLocal/gradeCompare';

/** Exceções configuráveis por sessão. Padrão: nenhuma exceção. */
export interface AutoAcceptRules {
  /** Divergência cadastral deixa de bloquear e passa a "Atualizar pelo boletim". */
  use_pdf_registry: boolean;
  /** Nome semelhante (>= 0,85) com candidato ÚNICO é vinculado automaticamente. */
  accept_unique_fuzzy: boolean;
  /** Divergência LOCAL × IA deixa de bloquear e adota-se a leitura local do boletim. */
  use_local_on_reconciliation: boolean;
}

export const DEFAULT_AUTO_ACCEPT_RULES: AutoAcceptRules = {
  use_pdf_registry: false,
  accept_unique_fuzzy: false,
  use_local_on_reconciliation: false,
};

/** Lê as regras persistidas na sessão de forma tolerante a sessões antigas. */
export const parseAutoAcceptRules = (value: unknown): AutoAcceptRules => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    use_pdf_registry: raw.use_pdf_registry === true,
    accept_unique_fuzzy: raw.accept_unique_fuzzy === true,
    use_local_on_reconciliation: raw.use_local_on_reconciliation === true,
  };
};

/**
 * Flags de célula que impedem a autoaceitação. Célula vazia NUNCA é erro.
 * `reconciliation_divergence` NÃO entra aqui: é tratada linha a linha (ver analyzeDivergences).
 */
const BLOCKING_CELL_FLAGS = [
  'invalid_value',
  'out_of_scale',
  'low_confidence',
  'conflicting_duplicate',
  'unmatched_student',
  'missing_subject',
];

/** Flags que, presentes na própria linha divergente, tornam a divergência inelegível. */
const DIVERGENCE_BLOCKING_FLAGS = [
  'invalid_value',
  'out_of_scale',
  'low_confidence',
  'conflicting_duplicate',
  'missing_subject',
];

/** Detalhe por célula de uma divergência LOCAL × IA (usado na UI e na decisão). */
export interface DivergenceDetail {
  index: number;
  subject: string;
  period: string;
  page: number | null;
  /** Valor lido diretamente do PDF (Fase 2). `null` = célula vazia legítima. */
  local_raw: string | null;
  local_value: number | null;
  /** Valor da validação por IA (segunda leitura). */
  ai_raw: string | null;
  confidence: number | null;
  source: 'local' | 'ai' | 'import' | 'manual' | undefined;
  /** Célula vista apenas pela IA — não existe leitura local para adotar. */
  ai_only: boolean;
  /** Elegível para adoção automática da leitura local. */
  local_eligible: boolean;
  /** Discordância apenas informativa: leitura local autoritativa foi preservada. */
  advisory: boolean;
  /** Motivos de inelegibilidade desta célula. */
  reasons: string[];
}

interface DivergenceRow {
  subject?: string;
  period?: string;
  page?: number | null;
  source_page?: number | null;
  raw_value?: string | null;
  value?: number | null;
  second_pass_value?: string | null;
  confidence?: number | null;
  flags?: string[];
  source?: string;
}

/** Analisa todas as divergências LOCAL × IA da página, por célula. Não grava nada. */
export const analyzeDivergences = (rows: DivergenceRow[]): {
  divergences: DivergenceDetail[];
  hasDivergence: boolean;
  allLocallyEligible: boolean;
  hasAiOnly: boolean;
  /** Todas as divergências são apenas discordância da IA (advisory). */
  onlyAdvisory: boolean;
} => {
  const divergences: DivergenceDetail[] = [];
  rows.forEach((row, index) => {
    const flags = row.flags ?? [];
    const advisory = flags.includes('ai_validation_disagreement');
    if (!flags.includes('reconciliation_divergence') && !advisory) return;
    const aiOnly = row.source === 'ai';
    // Defensivo: flag obsoleta (ex.: correção manual posterior) não é divergência.
    if (!aiOnly && matchesSecondPass(row.value ?? null, row.second_pass_value)) return;
    const value = row.value ?? null;
    const reasons: string[] = [];
    if (aiOnly) reasons.push('Somente a IA identificou esta célula — não existe valor local para autoaceite');
    if (value != null && (value < 0 || value > 10)) reasons.push('Valor local fora da escala 0–10');
    DIVERGENCE_BLOCKING_FLAGS.forEach((f) => {
      if (flags.includes(f)) reasons.push(`Célula com alerta bloqueante: ${f}`);
    });
    divergences.push({
      index,
      subject: row.subject ?? '—',
      period: row.period ?? '—',
      page: row.source_page ?? row.page ?? null,
      local_raw: aiOnly ? null : (row.raw_value ?? null),
      local_value: aiOnly ? null : value,
      ai_raw: row.second_pass_value ?? (aiOnly ? row.raw_value ?? null : null),
      confidence: row.confidence ?? null,
      source: row.source as DivergenceDetail['source'],
      ai_only: aiOnly,
      local_eligible: reasons.length === 0,
      advisory,
      reasons,
    });
  });
  return {
    divergences,
    hasDivergence: divergences.length > 0,
    allLocallyEligible: divergences.length > 0 && divergences.every((d) => d.local_eligible),
    hasAiOnly: divergences.some((d) => d.ai_only),
    onlyAdvisory: divergences.length > 0 && divergences.every((d) => d.advisory),
  };
};

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
  /** Códigos estáveis das exceções aplicadas (auditoria / confirmation_mode). */
  appliedExceptionCodes: string[];
  /** Diagnóstico completo das divergências LOCAL × IA da página. */
  divergences: DivergenceDetail[];
  /** Verdadeiro quando a única pendência relevante é divergência localmente elegível. */
  divergenceOnlyBlocker: boolean;
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
  const appliedCodes: string[] = [];
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
    if (fuzzyExceptionOn && detected.match_score >= 0.85) {
      applied.push('Nome semelhante com candidato único');
      appliedCodes.push('fuzzy_unique');
    }
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
  if (flagged.has('conflicting_duplicate')) reasons.push('Duplicidade conflitante');
  if (flagged.has('missing_subject')) reasons.push('Disciplina ausente');
  if (flagged.has('unmatched_student')) reasons.push('Aluno não identificado na turma');

  // Divergência LOCAL × IA: tratada linha a linha para manter segurança.
  const diag = analyzeDivergences(rows);
  const divergenceBlocking = diag.hasDivergence
    && !diag.onlyAdvisory
    && !(rules.use_local_on_reconciliation && diag.allLocallyEligible);
  const reasonsBeforeDivergence = [...new Set(reasons)].length;
  if (divergenceBlocking) {
    reasons.push('Divergência entre leituras');
  } else if (diag.hasDivergence && !diag.onlyAdvisory) {
    applied.push('Leitura local do boletim adotada em divergência de validação');
    appliedCodes.push('local_reconciliation');
  } else if (diag.hasDivergence) {
    applied.push('Discordância da IA registrada como aviso (leitura local autoritativa)');
    appliedCodes.push('local_authoritative');
  }

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
    appliedCodes.push('pdf_registry');
  } else if (regDecision) {
    critical(detected.pdf_code, detected.current?.school_code ?? null, 'Código');
    critical(detected.pdf_birth_date, detected.current?.birth_date ?? null, 'data de nascimento');
    critical(detected.pdf_mother_name, detected.current?.mother_name ?? null, 'nome da mãe');
    critical(detected.pdf_father_name, detected.current?.father_name ?? null, 'nome do pai');
  }

  const unique = [...new Set(reasons)];
  return {
    eligible: unique.length === 0,
    reasons: unique,
    appliedExceptions: [...new Set(applied)],
    appliedExceptionCodes: [...new Set(appliedCodes)],
    divergences: diag.divergences,
    // Única pendência = divergência, e todas as divergências podem adotar a leitura local.
    divergenceOnlyBlocker: divergenceBlocking
      && diag.allLocallyEligible
      && reasonsBeforeDivergence === 0
      && unique.length === 1,
  };
};
