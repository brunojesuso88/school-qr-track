/**
 * Confirmação manual SOBERANA da leitura local.
 *
 * Quando o usuário confere a página e confirma, o que vai para `student_grades` é
 * exclusivamente a leitura local (com as edições manuais). Linhas produzidas apenas
 * pela IA e flags de reconciliação nunca entram no payload acadêmico.
 */
import { ReviewRow } from './GradesReviewTable';

/** Flags de validação/reconciliação — diagnóstico do importador, não informação acadêmica. */
export const NON_ACADEMIC_FLAGS = [
  'reconciliation_divergence',
  'reconciled_match',
  'ai_validation_disagreement',
  'second_reading',
];

/** Flags que continuam bloqueando a confirmação manual (erro real de leitura). */
export const MANUAL_BLOCKING_FLAGS = ['invalid_value', 'out_of_scale', 'conflicting_duplicate'];

/** Remove linhas da IA e flags de validação, preservando flags acadêmicas (`explicit_zero` etc.). */
export const rowsForManualLocalConfirmation = (rows: ReviewRow[]): ReviewRow[] =>
  rows
    .filter((row) => row.source !== 'ai')
    .map((row) => ({
      ...row,
      flags: (row.flags ?? []).filter((f) => !NON_ACADEMIC_FLAGS.includes(f)),
    }));

/** Continua bloqueando erro real de leitura, mesmo na confirmação manual. */
export const manualConfirmationBlockers = (rows: ReviewRow[]): string[] => {
  const found = new Set<string>();
  rowsForManualLocalConfirmation(rows).forEach((r) =>
    (r.flags ?? []).forEach((f) => { if (MANUAL_BLOCKING_FLAGS.includes(f)) found.add(f); }));
  return [...found];
};

export type ReadingModeName = 'local_ai' | 'always_ai' | 'ai_only';

export interface AiPolicyInput {
  mode: ReadingModeName;
  /** Leitura local produziu prévia utilizável. */
  localOk: boolean;
  /** Leitura local é autoritativa (sem bloqueantes). */
  localAuthoritative: boolean;
}

/**
 * Política de uso da IA: no modo padrão a IA só entra quando a leitura local
 * NÃO é autoritativa (falhou, inconclusiva ou com risco real).
 */
export const shouldValidateWithAi = ({ mode, localOk, localAuthoritative }: AiPolicyInput): boolean => {
  if (mode === 'ai_only') return true;
  if (mode === 'always_ai') return true;
  return !(localOk && localAuthoritative);
};
