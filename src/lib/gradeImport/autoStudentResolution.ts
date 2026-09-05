/**
 * Resolução CADASTRAL automática do aluno da página do boletim.
 *
 * Separação obrigatória de responsabilidades:
 *  - esta decisão resolve QUEM é o aluno (vincular, mover de turma ou cadastrar);
 *  - a elegibilidade para GRAVAR notas é avaliada depois, à parte, e continua
 *    bloqueando valores inválidos/ambíguos.
 *
 * Regras invioláveis:
 *  - ambiguidade (`ambiguous_match`) ou vínculo duplicado (`duplicate_link`) NUNCA
 *    são resolvidos automaticamente;
 *  - candidato forte em outra turma da MESMA escola é movido (com auditoria), nunca duplicado;
 *  - criar aluno só quando não existe candidato algum e não há ambiguidade;
 *  - o cabeçalho precisa trazer um nome legível.
 */

export type StudentResolutionAction = 'link' | 'move' | 'create' | 'manual';

export type StudentResolutionReason =
  | 'rule_disabled'
  | 'ambiguous_candidates'
  | 'missing_header_name'
  | 'existing_class_match'
  | 'other_class_candidate'
  | 'no_candidate';

export interface StudentResolutionInput {
  /** Exceção "vincular/criar aluno não identificado" ativa (modo automático). */
  ruleActive: boolean;
  /** Conflitos detectados na leitura da página. */
  conflicts: string[];
  /** Nome do aluno lido no cabeçalho do boletim. */
  pdfName: string | null | undefined;
  /** Sugestão de aluno DESTA turma (match forte da leitura local). */
  suggestedStudentId: string | null | undefined;
  /** Candidato único e forte encontrado em outra turma da escola ativa. */
  otherClassStudentId?: string | null;
}

export interface StudentResolutionDecision {
  action: StudentResolutionAction;
  reason: StudentResolutionReason;
  studentId: string | null;
}

/** Conflitos que proíbem qualquer resolução automática. */
export const BLOCKING_CONFLICTS = ['ambiguous_match', 'duplicate_link'];

export const decideStudentResolution = (input: StudentResolutionInput): StudentResolutionDecision => {
  const conflicts = input.conflicts ?? [];
  if (conflicts.some((c) => BLOCKING_CONFLICTS.includes(c))) {
    return { action: 'manual', reason: 'ambiguous_candidates', studentId: null };
  }
  if (!input.ruleActive) return { action: 'manual', reason: 'rule_disabled', studentId: null };
  if (input.suggestedStudentId) {
    return { action: 'link', reason: 'existing_class_match', studentId: input.suggestedStudentId };
  }
  if (input.otherClassStudentId) {
    return { action: 'move', reason: 'other_class_candidate', studentId: input.otherClassStudentId };
  }
  if (!String(input.pdfName ?? '').trim()) {
    return { action: 'manual', reason: 'missing_header_name', studentId: null };
  }
  return { action: 'create', reason: 'no_candidate', studentId: null };
};

export interface StrongIdentityCandidate {
  id: string;
  full_name: string;
  school_code?: string | null;
}

/**
 * Reconsulta defensiva ANTES de inserir: se o banco já tem alguém com a mesma
 * identidade forte (código idêntico ou nome idêntico), vincula em vez de duplicar.
 * Dois ou mais resultados => manual.
 */
export const resolveBeforeCreate = (
  pdf: { name: string | null | undefined; code?: string | null },
  candidates: StrongIdentityCandidate[],
  helpers: {
    sameCode: (a: unknown, b: unknown) => boolean;
    sameName: (a: unknown, b: unknown) => boolean;
  },
): { action: 'link' | 'create' | 'manual'; studentId: string | null } => {
  const list = candidates ?? [];
  const byCode = pdf.code ? list.filter((s) => helpers.sameCode(s.school_code, pdf.code)) : [];
  if (byCode.length === 1) return { action: 'link', studentId: byCode[0].id };
  if (byCode.length > 1) return { action: 'manual', studentId: null };
  const byName = list.filter((s) => helpers.sameName(s.full_name, pdf.name));
  if (byName.length === 1) return { action: 'link', studentId: byName[0].id };
  if (byName.length > 1) return { action: 'manual', studentId: null };
  return { action: 'create', studentId: null };
};
