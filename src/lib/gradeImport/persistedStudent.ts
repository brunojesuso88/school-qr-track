/**
 * Identidade do aluno na GRAVAÇÃO do boletim.
 *
 * Regra única: o `student_id` escolhido na interface ("Aluno correspondente no
 * sistema") é a ÚNICA fonte da gravação. A sugestão automática da leitura
 * (`detected.student_id`) nunca é usada diretamente — ela apenas pré-seleciona
 * o campo da UI. Antes de gravar, o ID é validado no banco por
 * `student_id + school_id + class` (sem qualquer rematch textual).
 */
import { digitsOnly } from '@/lib/gradePageLocal/studentMatch';
import { normalizeText } from '@/lib/gradePageLocal/normalize';

export type PersistPageAction = 'link' | 'create' | 'ignore' | null;

export interface ResolvePersistedStudentInput {
  pageAction: PersistPageAction;
  /** ID selecionado na UI (sugestão aceita ou escolha manual). */
  linkStudentId: string | null | undefined;
  /** ID do aluno recém-cadastrado nesta página (ação "create"). */
  createdStudentId?: string | null;
}

/** Devolve o ID que DEVE ser gravado, ou null quando não há seleção válida. */
export const resolvePersistedStudentId = ({
  pageAction, linkStudentId, createdStudentId,
}: ResolvePersistedStudentInput): string | null => {
  if (pageAction === 'ignore') return null;
  if (pageAction === 'create') return clean(createdStudentId);
  return clean(linkStudentId);
};

const clean = (value: string | null | undefined) => {
  const v = String(value ?? '').trim();
  return v ? v : null;
};

export interface StudentScopeRow {
  id: string;
  class: string;
  school_id: string;
}

export interface StudentScopeExpectation {
  studentId: string | null;
  schoolId: string;
  /** Nomes aceitos para a turma (nome efetivo + nome da propriedade). */
  classNames: string[];
}

export type StudentScopeCode = 'missing_selection' | 'not_found' | 'other_school' | 'other_class';

export type StudentScopeCheck =
  | { ok: true; studentId: string; row: StudentScopeRow }
  | { ok: false; code: StudentScopeCode; message: string };

export const STUDENT_SCOPE_MESSAGES: Record<StudentScopeCode, string> = {
  missing_selection: 'Selecione o aluno correspondente no sistema antes de gravar a página.',
  not_found: 'O aluno selecionado não foi encontrado no banco. Recarregue a turma e selecione novamente.',
  other_school: 'O aluno selecionado pertence a outra escola e não pode receber notas desta turma.',
  other_class: 'O aluno selecionado não está nesta turma. Mova o aluno para a turma ou selecione outro.',
};

const sameClass = (a: string, b: string) => normalizeText(a) === normalizeText(b);

/** Validação pura do registro do banco contra escola + turma esperadas. */
export const validateStudentScope = (
  row: StudentScopeRow | null | undefined,
  expected: StudentScopeExpectation,
): StudentScopeCheck => {
  const studentId = clean(expected.studentId);
  if (!studentId) return { ok: false, code: 'missing_selection', message: STUDENT_SCOPE_MESSAGES.missing_selection };
  if (!row || row.id !== studentId) {
    return { ok: false, code: 'not_found', message: STUDENT_SCOPE_MESSAGES.not_found };
  }
  if (row.school_id !== expected.schoolId) {
    return { ok: false, code: 'other_school', message: STUDENT_SCOPE_MESSAGES.other_school };
  }
  const accepted = expected.classNames.filter(Boolean);
  if (accepted.length > 0 && !accepted.some((name) => sameClass(name, row.class))) {
    return {
      ok: false,
      code: 'other_class',
      message: `${STUDENT_SCOPE_MESSAGES.other_class} (cadastro atual: ${row.class}).`,
    };
  }
  return { ok: true, studentId, row };
};

export type StudentScopeLookup = (studentId: string) => Promise<StudentScopeRow | null>;

/** Resolve + valida no banco. `lookup` é injetável (testes) e busca SOMENTE por id. */
export const assertPersistedStudent = async (
  input: ResolvePersistedStudentInput,
  expected: Omit<StudentScopeExpectation, 'studentId'>,
  lookup: StudentScopeLookup,
): Promise<StudentScopeCheck> => {
  const studentId = resolvePersistedStudentId(input);
  if (!studentId) return validateStudentScope(null, { ...expected, studentId: null });
  const row = await lookup(studentId);
  return validateStudentScope(row, { ...expected, studentId });
};

// ---------------------------------------------------------------------------
// Memória de identidade entre páginas do MESMO aluno (boletim multipágina).
// ---------------------------------------------------------------------------

export interface StudentIdentityLike {
  pdf_code?: string | null;
  pdf_name?: string | null;
}

/** Chave de identidade do aluno no PDF: código (dígitos) tem prioridade; senão nome normalizado. */
export const studentIdentityKey = (identity: StudentIdentityLike | null | undefined): string | null => {
  if (!identity) return null;
  const code = digitsOnly(identity.pdf_code);
  if (code) return `code:${code}`;
  const name = normalizeText(identity.pdf_name);
  return name ? `name:${name}` : null;
};

export type PersistedStudentMemory = ReadonlyMap<string, string>;

/** Registra o ID efetivamente gravado para a identidade da página (imutável). */
export const rememberPersistedStudent = (
  memory: PersistedStudentMemory,
  identity: StudentIdentityLike | null | undefined,
  studentId: string | null,
): PersistedStudentMemory => {
  const key = studentIdentityKey(identity);
  const id = clean(studentId);
  if (!key || !id) return memory;
  const next = new Map(memory);
  next.set(key, id);
  return next;
};

/** Recupera o ID gravado em página anterior do mesmo aluno (ou null). */
export const recallPersistedStudent = (
  memory: PersistedStudentMemory,
  identity: StudentIdentityLike | null | undefined,
): string | null => {
  const key = studentIdentityKey(identity);
  return key ? memory.get(key) ?? null : null;
};
