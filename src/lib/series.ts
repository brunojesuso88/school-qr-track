/**
 * Representação ÚNICA da série/etapa acadêmica no EDUNEXUS.
 *
 * Valor persistido (banco):
 *   '1' | '2' | '3'                       → Ensino Médio regular
 *   'eja1' | 'eja2'                       → Etapas da EJA
 *   'ept1' | 'eve2' | 'sec2' | 'eve3' | 'sec3' → percursos da Matriz Integral
 *     (EPT = Educação Profissional e Tecnológica, EVE = Eventos, SEC = Secretariado)
 * (constraint de `classes.series`, `curriculum_matrix_subjects.series` e
 * `mapping_global_subjects.series`).
 * Rótulo visual: "1º ano do Ensino Médio", "1ª Etapa EJA", "2º ano EVE", etc.
 *
 * Rótulos legados ("1º ano", "1ª Série do Ensino Médio", "1 ano") são aceitos
 * APENAS na leitura, para não quebrar registros antigos. Nunca são gravados.
 *
 * EJA NUNCA se confunde com o regular: `1ª Etapa EJA` => 'eja1' (jamais '1').
 * Percursos Integral NUNCA colapsam para o regular: `2º ano EVE` => 'eve2' (jamais '2').
 */
export type HighSchoolSeries =
  | '1' | '2' | '3'
  | 'eja1' | 'eja2'
  | 'ept1' | 'eve2' | 'sec2' | 'eve3' | 'sec3';

/** Séries regulares do Ensino Médio (usadas em rankings por série). */
export type RegularSeries = '1' | '2' | '3';

/** Percursos/etapas próprios da Matriz Integral. */
export type IntegralSeries = 'ept1' | 'eve2' | 'sec2' | 'eve3' | 'sec3';

export const REGULAR_SERIES_VALUES: RegularSeries[] = ['1', '2', '3'];

export const EJA_SERIES_VALUES: HighSchoolSeries[] = ['eja1', 'eja2'];

export const INTEGRAL_SERIES_VALUES: IntegralSeries[] = ['ept1', 'eve2', 'sec2', 'eve3', 'sec3'];

export const SERIES_VALUES: HighSchoolSeries[] = [
  '1', '2', '3', 'eja1', 'eja2', 'ept1', 'eve2', 'sec2', 'eve3', 'sec3',
];

export const isEjaSeries = (s: string | null | undefined): boolean =>
  s === 'eja1' || s === 'eja2';

export const isIntegralSeries = (s: string | null | undefined): s is IntegralSeries =>
  (INTEGRAL_SERIES_VALUES as string[]).includes(String(s ?? ''));

export const isRegularSeries = (s: string | null | undefined): s is RegularSeries =>
  s === '1' || s === '2' || s === '3';

export const CLASS_SERIES_OPTIONS: { value: HighSchoolSeries; label: string }[] = [
  { value: '1', label: '1º ano do Ensino Médio' },
  { value: '2', label: '2º ano do Ensino Médio' },
  { value: '3', label: '3º ano do Ensino Médio' },
  { value: 'eja1', label: '1ª Etapa EJA' },
  { value: 'eja2', label: '2ª Etapa EJA' },
  { value: 'ept1', label: '1º ano EPT' },
  { value: 'eve2', label: '2º ano EVE' },
  { value: 'sec2', label: '2º ano SEC' },
  { value: 'eve3', label: '3º ano EVE' },
  { value: 'sec3', label: '3º ano SEC' },
];

/** Agrupamento para seletores: cada grupo tem um título curto. */
export const CLASS_SERIES_GROUPS: { label: string; values: HighSchoolSeries[] }[] = [
  { label: 'Ensino Médio', values: ['1', '2', '3'] },
  { label: 'EJA', values: ['eja1', 'eja2'] },
  { label: 'Integral (EPT / EVE / SEC)', values: ['ept1', 'eve2', 'sec2', 'eve3', 'sec3'] },
];

/** Rótulo curto para abas/badges ("1º ano" / "1ª Etapa EJA" / "2º ano EVE"). */
export const seriesShortLabel = (s: HighSchoolSeries | null | undefined) => {
  if (s === 'eja1') return '1ª Etapa EJA';
  if (s === 'eja2') return '2ª Etapa EJA';
  if (s === 'ept1') return '1º ano EPT';
  if (s === 'eve2') return '2º ano EVE';
  if (s === 'sec2') return '2º ano SEC';
  if (s === 'eve3') return '3º ano EVE';
  if (s === 'sec3') return '3º ano SEC';
  return s ? `${s}º ano` : 'sem série';
};

export const classSeriesLabel = (s: HighSchoolSeries | null | undefined) =>
  (s && CLASS_SERIES_OPTIONS.find((o) => o.value === s)?.label) || 'Série não definida';

/** Ordem canônica de exibição (regular → EJA → Integral). */
export const seriesSortIndex = (s: string | null | undefined) => {
  const idx = (SERIES_VALUES as string[]).indexOf(String(s ?? ''));
  return idx === -1 ? SERIES_VALUES.length : idx;
};

/**
 * Converte qualquer representação (valor canônico ou rótulo legado) no valor persistido.
 * Retorna `null` quando não há série clara ou quando há ambiguidade.
 */
export function parseSeriesValue(value: string | null | undefined): HighSchoolSeries | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if ((SERIES_VALUES as string[]).includes(raw.toLowerCase())) return raw.toLowerCase() as HighSchoolSeries;
  if (raw === '1' || raw === '2' || raw === '3') return raw;
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Percursos da Matriz Integral têm precedência sobre o regular: "2º ano EVE"
  // jamais é interpretado como 2º ano do Ensino Médio.
  const track = norm.match(/\b(ept|eve|sec)\b/g);
  if (track) {
    const tracks = new Set(track);
    if (tracks.size !== 1) return null;
    const code = [...tracks][0] as 'ept' | 'eve' | 'sec';
    const years = new Set<string>();
    const yearRe = /(^|[^0-9])([123])(?![0-9])/g;
    let ym: RegExpExecArray | null;
    while ((ym = yearRe.exec(norm))) years.add(ym[2]);
    if (years.size !== 1) return null;
    const candidate = `${code}${[...years][0]}`;
    return (INTEGRAL_SERIES_VALUES as string[]).includes(candidate) ? (candidate as HighSchoolSeries) : null;
  }

  // EJA tem precedência: qualquer menção clara a "EJA" ou "etapa" jamais é
  // interpretada como 1º/2º/3º ano regular.
  if (/\beja\b/.test(norm) || /etapa/.test(norm)) {
    const stages = new Set<HighSchoolSeries>();
    const stageRe = /(^|[^0-9])([12])(?![0-9])/g;
    let sm: RegExpExecArray | null;
    while ((sm = stageRe.exec(norm))) stages.add(`eja${sm[2]}` as HighSchoolSeries);
    return stages.size === 1 ? [...stages][0] : null;
  }

  const found = new Set<HighSchoolSeries>();
  const re = /(^|[^0-9])([123])\s*(?:a|o|º|ª|\.)?\s*(?:serie|ser|ano|em)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) found.add(m[2] as HighSchoolSeries);
  return found.size === 1 ? [...found][0] : null;
}


/** Normaliza uma lista (ex.: `mapping_global_subjects.series`) para valores persistíveis. */
export function normalizeSeriesList(list: (string | null | undefined)[] | null | undefined): HighSchoolSeries[] {
  const set = new Set<HighSchoolSeries>();
  (list ?? []).forEach((item) => {
    const parsed = parseSeriesValue(item);
    if (parsed) set.add(parsed);
  });
  return SERIES_VALUES.filter((v) => set.has(v));
}

/** `true` quando a série da turma pertence à lista de séries de um item do catálogo. */
export function seriesListMatches(
  series: string | null | undefined,
  list: (string | null | undefined)[] | null | undefined,
): boolean {
  const target = parseSeriesValue(series);
  if (!target) return false;
  return normalizeSeriesList(list).includes(target);
}
