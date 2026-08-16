/**
 * Matching de aluno (boletim × turma) em camadas, determinístico e conservador.
 * Nunca autoaceita ambiguidade: duas ou mais opções plausíveis => conflito manual.
 */

export type MatchStatus = 'matched' | 'fuzzy' | 'ambiguous' | 'unmatched';

export interface MatchCandidate {
  id: string;
  full_name: string;
  school_code?: string | null;
  student_id?: string | null;
  class?: string | null;
}

export interface MatchOutcome<T extends MatchCandidate = MatchCandidate> {
  student: T | null;
  score: number;
  status: MatchStatus;
  /** 'code' | 'name' | 'fuzzy' | null — como o vínculo foi obtido. */
  by: 'code' | 'name' | 'fuzzy' | null;
  /** Candidatos plausíveis quando houver ambiguidade. */
  candidates: T[];
}

/** Limiar alto para sugestão por semelhança (nunca autoaceite). */
export const FUZZY_THRESHOLD = 0.85;

const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\ufeff\u00ad]/g;

/** Somente dígitos, sem zeros à esquerda (para comparar "0012.345" com "12345"). */
export const digitsOnly = (value: unknown) => {
  const digits = String(value ?? '').replace(INVISIBLE, '').replace(/\D+/g, '');
  if (!digits) return '';
  const trimmed = digits.replace(/^0+/, '');
  return trimmed || '0';
};

/** NFD sem acentos, minúsculo, pontuação/invisíveis => espaço, espaços colapsados. */
export const normalizeNameForMatch = (value: unknown) =>
  String(value ?? '')
    .replace(INVISIBLE, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'del', 'della', 'du']);

/** Tokens significativos do nome (partículas descartadas). */
export const nameTokens = (value: unknown) =>
  normalizeNameForMatch(value).split(' ').filter((t) => t && !PARTICLES.has(t));

/** Similaridade por conjunto de tokens (Dice) — tolera ordem, não tolera nomes diferentes. */
export const tokenSetSimilarity = (a: unknown, b: unknown) => {
  const setA = new Set(nameTokens(a));
  const setB = new Set(nameTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  setA.forEach((t) => { if (setB.has(t)) inter++; });
  return (2 * inter) / (setA.size + setB.size);
};

/** Nomes equivalentes: mesmo conjunto de tokens significativos (ordem irrelevante). */
export const sameNormalizedName = (a: unknown, b: unknown) => {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  if (normalizeNameForMatch(a) === normalizeNameForMatch(b)) return true;
  if (ta.length !== tb.length) return false;
  return [...ta].sort().join(' ') === [...tb].sort().join(' ');
};

/**
 * Camadas:
 *  A. código (só dígitos) único na turma        -> matched
 *  B. nome normalizado exato único na turma     -> matched
 *  C. semelhança >= 0.85 com candidato ÚNICO    -> fuzzy (sugestão, exige confirmação)
 *  D. dois ou mais candidatos plausíveis        -> ambiguous (conflito manual)
 *  E. nada                                      -> unmatched
 */
export function matchStudentInClass<T extends MatchCandidate>(
  pdf: { name: string | null | undefined; code?: string | null },
  students: T[],
): MatchOutcome<T> {
  const empty: MatchOutcome<T> = { student: null, score: 0, status: 'unmatched', by: null, candidates: [] };
  if (!students || students.length === 0) return empty;

  const pdfCode = digitsOnly(pdf.code);
  if (pdfCode) {
    const byCode = students.filter((s) => digitsOnly(s.school_code) === pdfCode);
    if (byCode.length === 1) return { student: byCode[0], score: 1, status: 'matched', by: 'code', candidates: byCode };
    if (byCode.length > 1) return { student: null, score: 1, status: 'ambiguous', by: 'code', candidates: byCode };
  }

  const byName = students.filter((s) => sameNormalizedName(pdf.name, s.full_name));
  if (byName.length === 1) return { student: byName[0], score: 1, status: 'matched', by: 'name', candidates: byName };
  if (byName.length > 1) return { student: null, score: 1, status: 'ambiguous', by: 'name', candidates: byName };

  const scored = students
    .map((s) => ({ student: s, score: tokenSetSimilarity(pdf.name, s.full_name) }))
    .filter((entry) => entry.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    return { student: scored[0].student, score: scored[0].score, status: 'fuzzy', by: 'fuzzy', candidates: [scored[0].student] };
  }
  if (scored.length > 1) {
    return {
      student: null,
      score: scored[0].score,
      status: 'ambiguous',
      by: 'fuzzy',
      candidates: scored.map((entry) => entry.student),
    };
  }

  const best = students.reduce(
    (acc, s) => {
      const score = tokenSetSimilarity(pdf.name, s.full_name);
      return score > acc.score ? { student: s, score } : acc;
    },
    { student: null as T | null, score: 0 },
  );
  return { student: null, score: best.score, status: 'unmatched', by: null, candidates: [] };
}

/** Busca por identidade forte (código ou nome exato) fora da turma atual. */
export function findGlobalMatch<T extends MatchCandidate>(
  pdf: { name: string | null | undefined; code?: string | null },
  students: T[],
): { student: T | null; by: 'code' | 'name' | null; ambiguous: boolean } {
  const pdfCode = digitsOnly(pdf.code);
  if (pdfCode) {
    const byCode = students.filter((s) => digitsOnly(s.school_code) === pdfCode);
    if (byCode.length === 1) return { student: byCode[0], by: 'code', ambiguous: false };
    if (byCode.length > 1) return { student: null, by: 'code', ambiguous: true };
  }
  const byName = students.filter((s) => sameNormalizedName(pdf.name, s.full_name));
  if (byName.length === 1) return { student: byName[0], by: 'name', ambiguous: false };
  if (byName.length > 1) return { student: null, by: 'name', ambiguous: true };
  return { student: null, by: null, ambiguous: false };
}

/**
 * Nome da turma a usar no contexto da importação: o do banco tem prioridade,
 * depois o nome efetivo da sessão e, só em falha de leitura, a prop do card.
 */
export const pickClassName = (
  dbName: string | null | undefined,
  effectiveName: string | null | undefined,
  propName: string | null | undefined,
) => (dbName ?? '').trim() || (effectiveName ?? '').trim() || (propName ?? '').trim();
