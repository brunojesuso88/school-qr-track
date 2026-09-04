/**
 * Representação ÚNICA da série/etapa acadêmica no EDUNEXUS.
 *
 * Valor persistido (banco): '1' | '2' | '3' | 'eja1' | 'eja2'
 * (constraint de `classes.series`, `curriculum_matrix_subjects.series` e
 * `mapping_global_subjects.series`).
 * Rótulo visual: "1º ano do Ensino Médio", "1ª Etapa EJA", etc.
 *
 * Rótulos legados ("1º ano", "1ª Série do Ensino Médio", "1 ano") são aceitos
 * APENAS na leitura, para não quebrar registros antigos. Nunca são gravados.
 *
 * EJA NUNCA se confunde com o regular: `1ª Etapa EJA` => 'eja1' (jamais '1').
 */
export type HighSchoolSeries = '1' | '2' | '3' | 'eja1' | 'eja2';

/** Séries regulares do Ensino Médio (usadas em rankings por série). */
export type RegularSeries = '1' | '2' | '3';

export const REGULAR_SERIES_VALUES: RegularSeries[] = ['1', '2', '3'];

export const EJA_SERIES_VALUES: HighSchoolSeries[] = ['eja1', 'eja2'];

export const SERIES_VALUES: HighSchoolSeries[] = ['1', '2', '3', 'eja1', 'eja2'];

export const isEjaSeries = (s: string | null | undefined): boolean =>
  s === 'eja1' || s === 'eja2';

export const CLASS_SERIES_OPTIONS: { value: HighSchoolSeries; label: string }[] = [
  { value: '1', label: '1º ano do Ensino Médio' },
  { value: '2', label: '2º ano do Ensino Médio' },
  { value: '3', label: '3º ano do Ensino Médio' },
  { value: 'eja1', label: '1ª Etapa EJA' },
  { value: 'eja2', label: '2ª Etapa EJA' },
];

/** Rótulo curto para abas/badges ("1º ano" / "1ª Etapa EJA"). */
export const seriesShortLabel = (s: HighSchoolSeries | null | undefined) => {
  if (s === 'eja1') return '1ª Etapa EJA';
  if (s === 'eja2') return '2ª Etapa EJA';
  return s ? `${s}º ano` : 'sem série';
};

export const classSeriesLabel = (s: HighSchoolSeries | null | undefined) =>
  (s && CLASS_SERIES_OPTIONS.find((o) => o.value === s)?.label) || 'Série não definida';

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
