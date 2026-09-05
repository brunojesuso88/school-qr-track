/**
 * REBIND de identidade do aluno no momento de EXIBIR a prévia.
 *
 * Boletins multipágina: a página N+1 pode ser PRÉ-LIDA (LocalPrefetchQueue)
 * antes de a página N cadastrar/vincular o aluno. A prévia cacheada fica então
 * com `detected.student_id = null` e `unmatched_student`, mesmo que o aluno já
 * exista no contexto atualizado.
 *
 * Este helper é PURO: recebe o cabeçalho lido do PDF, a lista de alunos ATUAL e
 * a memória da sessão, e devolve o aluno seguro (ou null quando exige escolha
 * manual). Nunca há fuzzy permissivo: apenas
 *   1. memória da sessão (aluno já resolvido em página anterior deste boletim);
 *   2. `matchStudentInClass` com status `matched` (código completo ou nome exato).
 */
import { matchStudentInClass, type MatchCandidate } from '@/lib/gradePageLocal/studentMatch';
import { recallPersistedStudent, type PersistedStudentMemory, type StudentIdentityLike } from './persistedStudent';

export interface RebindDetectedLike extends StudentIdentityLike {
  student_id?: string | null;
}

export type RebindSource = 'memory' | 'match';

export interface RebindResult {
  studentId: string;
  fullName: string;
  schoolCode?: string | null;
  source: RebindSource;
}

export interface RebindInput<T extends MatchCandidate> {
  detected: RebindDetectedLike;
  students: T[];
  memory?: PersistedStudentMemory;
}

/**
 * Devolve o aluno a ser adotado pela prévia, ou null quando nada seguro existe
 * (inclui ambiguidade/homônimo, que continuam manuais).
 */
export const rebindDetectedStudent = <T extends MatchCandidate>(
  { detected, students, memory }: RebindInput<T>,
): RebindResult | null => {
  if (!detected) return null;
  if (String(detected.student_id ?? '').trim()) return null; // já resolvido

  const list = students ?? [];

  if (memory) {
    const recalled = recallPersistedStudent(memory, detected);
    const known = recalled ? list.find((s) => s.id === recalled) : undefined;
    if (recalled && known) {
      return {
        studentId: known.id,
        fullName: known.full_name,
        schoolCode: known.school_code ?? null,
        source: 'memory',
      };
    }
  }

  const outcome = matchStudentInClass(
    { name: detected.pdf_name ?? null, code: detected.pdf_code ?? null },
    list,
  );
  if (outcome.status !== 'matched' || !outcome.student) return null;
  return {
    studentId: outcome.student.id,
    fullName: outcome.student.full_name,
    schoolCode: outcome.student.school_code ?? null,
    source: 'match',
  };
};
