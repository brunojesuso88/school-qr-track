/** Tipos da leitura LOCAL (determinística) do boletim. Nada aqui grava dados. */

export interface TextToken {
  text: string;
  /** canto esquerdo */
  x: number;
  /** linha de base (y crescente para cima, como no PDF) */
  y: number;
  w: number;
  h: number;
}

export interface TokenLine {
  y: number;
  height: number;
  tokens: TextToken[];
  text: string;
}

export interface GridColumn {
  /** rótulo canônico do período/etapa */
  label: string;
  kind: string;
  sort_order: number;
  /** intervalo x da subcoluna de NOTA */
  start: number;
  end: number;
}

export interface AbsenceColumn {
  start: number;
  end: number;
}

export interface GridLayout {
  columns: GridColumn[];
  absenceColumns: AbsenceColumn[];
  /** Colunas finais do boletim (Média Final, Rec. Final, Cons. Class, Pendência, Final) — descartadas. */
  ignoredColumns: AbsenceColumn[];
  /** x onde termina a coluna de disciplinas */
  subjectColumnEnd: number;
  /** índice da linha do cabeçalho de períodos */
  headerLineIndex: number;
  /** índice da linha das subcolunas Nota/Faltas (quando existir) */
  subHeaderLineIndex: number | null;
}

export interface LocalHeader {
  name: string | null;
  student_code: string | null;
  birth_date: string | null;
  mother_name: string | null;
  father_name: string | null;
  class_code: string | null;
}

export interface LocalCell {
  subject: string;
  /**
   * Ocorrência da disciplina na página (1 = primeira). Boletins do Integral podem
   * trazer a MESMA disciplina duas vezes na mesma etapa: cada ocorrência é um slot
   * distinto e nunca é fundida com a outra.
   */
  slot: number;
  period: string;
  period_kind: string;
  raw_value: string | null;
  value: number | null;
  invalid: boolean;
  confidence: number;
  ambiguous: boolean;
  /** Linha materializada por âncora curricular (disciplina real sem notas lançadas). */
  anchored?: boolean;
}

/** Disciplina esperada da turma (matriz efetiva + catálogo canônico). */
export interface LocalExpectedSubject {
  /** Nome canônico da disciplina na matriz da turma/catálogo. */
  name: string;
  weekly_classes?: number | null;
  /** Ocorrência (slot) do componente na matriz da turma — 1 quando não há duplicata. */
  slot_index?: number;
  /** Nomes equivalentes como aparecem no boletim em PDF. */
  aliases?: string[];
  abbreviation?: string | null;
  /** Origem para diagnóstico: matriz oficial da série, matriz da turma, boletim importado, catálogo. */
  origin?: ('matrix' | 'mapping' | 'grade' | 'catalog')[];
}

export interface LocalContextStudent {
  id: string;
  full_name: string;
  student_id?: string | null;
  school_code?: string | null;
  birth_date?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
}

export interface LocalParseContext {
  page: number;
  totalPages: number;
  students: LocalContextStudent[];
  expectedSubjects: LocalExpectedSubject[];
}

export interface LocalValidation {
  conclusive: boolean;
  /** 0..1 — qualidade da leitura local */
  score: number;
  reasons: string[];
  /** Códigos estáveis de risco real (impedem autoridade da leitura local). */
  blockers?: string[];
  /** Códigos estáveis informativos (não impedem autoridade). */
  advisories?: string[];
}