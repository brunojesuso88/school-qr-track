/** Tipos e regras da conferência de alunos do boletim × turma (etapa anterior à confirmação). */

export interface DetectedStudentRegistry {
  school_code: string | null;
  birth_date: string | null;
  mother_name: string | null;
  father_name: string | null;
  student_id: string | null;
}

export interface DetectedStudent {
  key: string;
  pdf_name: string;
  pdf_code: string | null;
  pdf_birth_date: string | null;
  pdf_mother_name: string | null;
  pdf_father_name: string | null;
  pages: number[];
  cells: number;
  student_id: string | null;
  matched_name: string | null;
  match_score: number;
  status: 'matched' | 'fuzzy' | 'unmatched';
  conflicts: string[];
  current: DetectedStudentRegistry | null;
}

export type ResolutionAction = 'confirm' | 'link' | 'create' | 'ignore';

export interface Resolution {
  action: ResolutionAction | null;
  student_id: string | null;
}

export type FieldDecision = 'keep' | 'update';

export interface RegistrationDecision {
  code: FieldDecision;
  birth_date: FieldDecision;
  mother: FieldDecision;
  father: FieldDecision;
}

export const CONFLICT_LABELS: Record<string, string> = {
  not_in_class: 'Aluno do boletim não encontrado na turma',
  ambiguous_match: 'Mais de um aluno da turma corresponde — escolha manual necessária',
  other_class: 'Aluno encontrado em outra turma do sistema',
  name_similar: 'Nome semelhante, mas não idêntico',
  duplicate_link: 'Possível duplicidade: dois nomes do PDF para o mesmo aluno',
  multiple_pages: 'Aluno aparece em mais de uma página',
  code_mismatch: 'Código divergente do cadastro',
  birth_date_mismatch: 'Data de nascimento divergente',
  mother_mismatch: 'Nome da mãe divergente',
  father_mismatch: 'Nome do pai divergente',
};

/** Conflitos que exigem decisão explícita do usuário antes de confirmar a importação. */
export const needsResolution = (d: DetectedStudent) =>
  d.status !== 'matched' || d.conflicts.includes('duplicate_link');

export const isResolved = (d: DetectedStudent, r: Resolution | undefined) => {
  if (!needsResolution(d)) return true;
  if (!r?.action) return false;
  if (r.action === 'link') return Boolean(r.student_id);
  return true;
};

const sameText = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLocaleLowerCase('pt-BR') === (b ?? '').trim().toLocaleLowerCase('pt-BR');

/** Nunca sobrescreve silenciosamente: só atualiza sozinho quando o cadastro está vazio. */
export const defaultRegistrationDecision = (d: DetectedStudent): RegistrationDecision => {
  const decide = (pdfValue: string | null, current: string | null): FieldDecision => {
    if (!pdfValue) return 'keep';
    if (!current) return 'update';
    return 'keep';
  };
  return {
    code: decide(d.pdf_code, d.current?.school_code ?? null),
    birth_date: decide(d.pdf_birth_date, d.current?.birth_date ?? null),
    mother: decide(d.pdf_mother_name, d.current?.mother_name ?? null),
    father: decide(d.pdf_father_name, d.current?.father_name ?? null),
  };
};

export const hasRegistrationDivergence = (d: DetectedStudent) => {
  if (!d.current) return false;
  return (
    (!!d.pdf_code && !!d.current.school_code && !sameText(d.pdf_code, d.current.school_code)) ||
    (!!d.pdf_birth_date && !!d.current.birth_date && d.pdf_birth_date !== d.current.birth_date) ||
    (!!d.pdf_mother_name && !!d.current.mother_name && !sameText(d.pdf_mother_name, d.current.mother_name)) ||
    (!!d.pdf_father_name && !!d.current.father_name && !sameText(d.pdf_father_name, d.current.father_name))
  );
};

export const hasRegistrationData = (d: DetectedStudent) =>
  Boolean(d.pdf_code || d.pdf_birth_date || d.pdf_mother_name || d.pdf_father_name);

export const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
