/**
 * Separação explícita entre RESOLUÇÃO CADASTRAL e ELEGIBILIDADE ACADÊMICA.
 *
 * A resolução cadastral (quem é o aluno: vincular / mover / cadastrar) acontece
 * IMEDIATAMENTE, sem depender da confirmação da página: uma nota inválida na
 * página não pode impedir o cadastro do aluno.
 *
 * A elegibilidade acadêmica (gravar notas) continua sendo avaliada à parte e
 * segue bloqueando `invalid_value`, `local_ai_divergence`, `existing_grade_conflict`, etc.
 */

/** Conflitos puramente CADASTRAIS — os únicos removíveis ao resolver o aluno. */
export const REGISTRY_CONFLICTS = ['not_in_class', 'unmatched_student', 'student_registry_unresolved'];

/** Flags de linha puramente cadastrais. */
export const REGISTRY_ROW_FLAGS = ['unmatched_student'];

export interface ResolvedStudentIdentity {
  studentId: string;
  fullName: string;
}

export interface DetectedLike {
  student_id?: string | null;
  matched_name?: string | null;
  status?: string;
  conflicts: string[];
  [key: string]: unknown;
}

/**
 * Aplica o aluno resolvido ao cabeçalho detectado, removendo SOMENTE os
 * conflitos cadastrais. Qualquer outro conflito (nota inválida, divergência,
 * conflito com nota existente) é preservado intacto.
 */
export const applyResolvedStudentToDetected = <T extends DetectedLike>(
  detected: T,
  identity: ResolvedStudentIdentity,
): T => ({
  ...detected,
  student_id: identity.studentId,
  matched_name: identity.fullName,
  status: 'matched',
  conflicts: (detected.conflicts ?? []).filter((c) => !REGISTRY_CONFLICTS.includes(c)),
});

/** Remove apenas as flags cadastrais das linhas; flags acadêmicas permanecem. */
export const stripRegistryRowFlags = <T extends { flags?: string[] }>(rows: T[]): T[] =>
  (rows ?? []).map((row) => ({
    ...row,
    flags: (row.flags ?? []).filter((f) => !REGISTRY_ROW_FLAGS.includes(f)),
  }));

export type RegistrationPhase = 'idle' | 'running' | 'resolved' | 'failed';

export interface RegistrationLockState {
  key: string | null;
  phase: RegistrationPhase;
}

/**
 * Lock de concorrência: uma única resolução por página em andamento, e sempre
 * liberado em falha para permitir retry (nunca duplica aluno em re-render).
 */
export const shouldStartRegistration = (
  lock: RegistrationLockState,
  key: string,
): boolean => {
  if (lock.key !== key) return true;
  return lock.phase === 'failed';
};
