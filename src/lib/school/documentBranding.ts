/**
 * Identidade institucional usada em DOCUMENTOS e telas (PDF, impressão, cabeçalhos).
 *
 * Nada aqui pode ser hardcoded para uma escola específica: os dados vêm sempre
 * da escola ativa (tabela `schools` + `settings`).
 */

export const SCHOOL_CITY_SETTING_KEY = 'school_city';
export const SCHOOL_STATE_SETTING_KEY = 'school_state';
export const SCHOOL_AUTHORITY_SETTING_KEY = 'school_authority';

/** Fallbacks neutros (nunca citam uma escola real). */
export const FALLBACK_SCHOOL_NAME = 'Instituição de Ensino';

export interface SchoolDocumentBranding {
  /** Nome institucional da escola ativa (fallback neutro se vazio). */
  schoolName: string;
  /** Nome em caixa alta, como usado nos cabeçalhos oficiais. */
  schoolNameUpper: string;
  city: string;
  state: string;
  /** "Cidade - UF" (vazio se não configurado). */
  cityStateLine: string;
  /** Órgão/secretaria mantenedora, opcional. */
  authority: string;
  /** Brasão da escola ativa: URL assinada e dataURL (para PDF/janela de impressão). */
  logoUrl: string | null;
  logoDataUrl: string | null;
  loading: boolean;
}

export const documentSchoolName = (name: string | null | undefined): string => {
  const value = (name ?? '').trim();
  return value || FALLBACK_SCHOOL_NAME;
};

export const formatCityState = (
  city: string | null | undefined,
  state: string | null | undefined,
  separator = ' - ',
): string => {
  const c = (city ?? '').trim();
  const s = (state ?? '').trim().toUpperCase();
  if (c && s) return `${c}${separator}${s}`;
  return c || s;
};

/** Linha "Cidade/UF, dd/mm/aaaa" — sem cidade, retorna apenas a data. */
export const cityDateLine = (
  cityState: string | null | undefined,
  dateBR: string,
): string => {
  const place = (cityState ?? '').trim();
  return place ? `${place}, ${dateBR}` : dateBR;
};

/** Divide o nome longo em duas linhas para cabeçalhos de PDF de largura fixa. */
export const splitSchoolNameLines = (name: string | null | undefined): [string, string] => {
  const value = documentSchoolName(name).toUpperCase();
  const words = value.split(/\s+/);
  if (words.length < 4) return ['', value];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
};
