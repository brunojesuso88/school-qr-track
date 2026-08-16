/** Normalização pt-BR e parsing de tokens de nota. Regras idênticas à Edge Function. */

export const normalizeText = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9º°ª\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const EMPTY_MARKERS = ['-', '--', '---', '—', '–', 'n/a', 'na', 'nc', '*', '.', '..'];

/**
 * Normalização que PRESERVA o comprimento e os índices do texto original,
 * permitindo casar rótulos no texto normalizado e recortar o valor no texto original.
 */
export const normalizeAligned = (s: unknown) =>
  Array.from(String(s ?? ''))
    .map((ch) => {
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0] ?? ' ';
      const lower = base.toLowerCase();
      return /[a-z0-9º°ª]/.test(lower) ? lower : ' ';
    })
    .join('');

/** Vazio => null. `0,00` => 0 real. Fora do padrão => invalid. */
export function parseGradeToken(raw: string | null | undefined): { value: number | null; invalid: boolean } {
  if (raw == null) return { value: null, invalid: false };
  const text = String(raw).trim();
  if (!text || EMPTY_MARKERS.includes(text.toLowerCase())) return { value: null, invalid: false };
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return { value: null, invalid: true };
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return { value: null, invalid: true };
  return { value: num, invalid: false };
}

/** Token que PODE ser nota: 1 ou 2 dígitos inteiros. 3+ dígitos = código/falta acumulada. */
export const looksLikeGradeToken = (text: string) => /^\d{1,2}([.,]\d{1,2})?$/.test(text.trim());

export const isEmptyMarker = (text: string) => EMPTY_MARKERS.includes(text.trim().toLowerCase());

export const isAbsenceLabel = (label: string) => /falta/.test(normalizeText(label));
export const isGradeLabel = (label: string) => /^nota/.test(normalizeText(label));

export function classifyPeriodLabel(label: string): { kind: string; canonical: string } | null {
  const norm = normalizeText(label);
  if (!norm) return null;
  const period = norm.match(/^([1-4])\s*(º|°|o|a|ª)?\s*(periodo|bimestre|etapa|trimestre)$/);
  if (period) return { kind: 'period', canonical: `${period[1]}º Período` };
  if (/^med(ia)?\s*final$/.test(norm)) return { kind: 'media_final', canonical: 'Média Final' };
  if (/^rec\s*final$/.test(norm)) return { kind: 'rec_final', canonical: 'Rec. Final' };
  if (/^cons\s*class/.test(norm)) return { kind: 'cons_class', canonical: 'Cons. Class' };
  if (/^pendencia$/.test(norm)) return { kind: 'pendencia', canonical: 'Pendência' };
  if (/^final$/.test(norm)) return { kind: 'final', canonical: 'Final' };
  return null;
}

export const PERIOD_ORDER = [
  '1º período', '2º período', '3º período', '4º período',
  'media final', 'rec final', 'cons class', 'pendencia', 'final',
];

export const periodRank = (label: string) => {
  const idx = PERIOD_ORDER.indexOf(normalizeText(label));
  return idx === -1 ? PERIOD_ORDER.length : idx;
};

/** Similaridade por tokens (mesma heurística usada na Edge Function). */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  const inter = at.filter((t) => bt.includes(t)).length;
  const tokenScore = (2 * inter) / (at.length + bt.length);
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return Math.min(1, tokenScore + (longer.includes(shorter) ? 0.15 : 0));
}

/** dd/mm/aaaa -> aaaa-mm-dd. Qualquer outro formato => null. */
export function toIsoDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = String(text).trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = String(text).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? iso[0] : null;
}