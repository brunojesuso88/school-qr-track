/** Camada de decisão automática por página (acima da confirmação manual). Nada aqui grava dados. */
import { ReviewRow } from './GradesReviewTable';
import { DetectedStudent, RegistrationDecision } from './gradesConflicts';

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
}

export interface AutoAcceptResult {
  eligible: boolean;
  reasons: string[];
}

/** Regra ESTRITA: só é elegível quando não há nenhum problema pendente na página. */
export const evaluateAutoAccept = (input: AutoAcceptInput): AutoAcceptResult => {
  const {
    detected, rows, classDecisionPending, pageHasExistingGrades,
    linkedStudentId, suggestedStudentId, regDecision,
  } = input;
  const reasons: string[] = [];

  if (classDecisionPending) reasons.push('Turma do PDF diferente da turma selecionada');

  if (!linkedStudentId || linkedStudentId !== suggestedStudentId) {
    reasons.push('Aluno da página ainda não vinculado automaticamente');
  }
  if (detected.status !== 'matched') {
    reasons.push(detected.status === 'unmatched'
      ? 'Aluno não identificado na turma'
      : 'Aluno identificado apenas por semelhança de nome');
  }
  if (detected.conflicts.length > 0) reasons.push('Conflitos de aluno pendentes');

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
  if (regDecision) {
    critical(detected.pdf_code, detected.current?.school_code ?? null, 'Código');
    critical(detected.pdf_birth_date, detected.current?.birth_date ?? null, 'data de nascimento');
    critical(detected.pdf_mother_name, detected.current?.mother_name ?? null, 'nome da mãe');
    critical(detected.pdf_father_name, detected.current?.father_name ?? null, 'nome do pai');
  }

  const unique = [...new Set(reasons)];
  return { eligible: unique.length === 0, reasons: unique };
};
