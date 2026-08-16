/**
 * Representação ÚNICA da série do Ensino Médio no EDUNEXUS.
 *
 * Valor persistido (banco): '1' | '2' | '3'  (constraint de `classes.series`
 * e de `mapping_global_subjects.series`).
 * Rótulo visual: "1º ano do Ensino Médio", etc.
 *
 * Rótulos legados ("1º ano", "1ª Série do Ensino Médio", "1 ano") são aceitos
 * APENAS na leitura, para não quebrar registros antigos. Nunca são gravados.
 */
export type HighSchoolSeries = '1' | '2' | '3';

export const SERIES_VALUES: HighSchoolSeries[] = ['1', '2', '3'];

export const CLASS_SERIES_OPTIONS: { value: HighSchoolSeries; label: string }[] = [
  { value: '1', label: '1º ano do Ensino Médio' },
  { value: '2', label: '2º ano do Ensino Médio' },
  { value: '3', label: '3º ano do Ensino Médio' },
];

export const classSeriesLabel = (s: HighSchoolSeries | null | undefined) =>
  (s && CLASS_SERIES_OPTIONS.find((o) => o.value === s)?.label) || 'Série não definida';

/**
 * Converte qualquer representação (valor canônico ou rótulo legado) no valor persistido.
 * Retorna `null` quando não há série clara ou quando há ambiguidade.
 */
export function parseSeriesValue(value: string | null | undefined): HighSchoolSeries | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (raw === '1' || raw === '2' || raw === '3') return raw;
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
