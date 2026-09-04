/** Métricas locais da sessão de importação (sem analytics externo). */
import { hasWeeklyLoad } from '@/lib/ira';

export interface ReadingMetricsInput {
  /** Páginas resolvidas apenas com leitura local. */
  localPages: number;
  /** Páginas em que a IA foi chamada (validação ou fallback). */
  aiPages: number;
  /** Páginas ignoradas em silêncio (sem disciplina) ou pelo usuário. */
  ignoredPages: number;
  /** Duração (ms) das leituras locais. */
  timingsMs: number[];
}

export interface ReadingMetrics {
  localPages: number;
  aiPages: number;
  ignoredPages: number;
  readPages: number;
  /** % de páginas lidas sem IA (0–100, inteiro). */
  localPct: number;
  avgLocalMs: number | null;
}

export const summarizeReadingMetrics = (input: ReadingMetricsInput): ReadingMetrics => {
  const localPages = Math.max(0, input.localPages | 0);
  const aiPages = Math.max(0, input.aiPages | 0);
  const ignoredPages = Math.max(0, input.ignoredPages | 0);
  const readPages = localPages + aiPages;
  const timings = input.timingsMs.filter((t) => Number.isFinite(t) && t >= 0);
  return {
    localPages,
    aiPages,
    ignoredPages,
    readPages,
    localPct: readPages === 0 ? 0 : Math.round((localPages / readPages) * 100),
    avgLocalMs: timings.length === 0 ? null : Math.round(timings.reduce((a, b) => a + b, 0) / timings.length),
  };
};

export const formatReadingMetrics = (m: ReadingMetrics): string => {
  const parts = [
    `Leitura local: ${m.localPages} página(s)`,
    `IA: ${m.aiPages} página(s)`,
    `ignoradas: ${m.ignoredPages}`,
  ];
  if (m.avgLocalMs != null) parts.push(`tempo médio local ${m.avgLocalMs}ms`);
  parts.push(`${m.localPct}% sem IA`);
  return parts.join(' · ');
};

/**
 * Carga semanal a persistir em `grade_subjects` na regravação de uma disciplina:
 * nunca rebaixa um valor já informado para 0/null por causa de uma prévia sem carga.
 */
export const resolveWeeklyClassesForUpsert = (
  incoming: number | null | undefined,
  previous: number | null | undefined,
): number | null => {
  if (hasWeeklyLoad(incoming)) return incoming as number;
  if (hasWeeklyLoad(previous)) return previous as number;
  return incoming ?? previous ?? null;
};
