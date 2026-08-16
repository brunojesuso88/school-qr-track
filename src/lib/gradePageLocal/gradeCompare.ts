/**
 * Comparação semântica de notas compartilhada por parser, reconciliação, autoaceite e UI.
 * Invariantes: null != 0, `0,00` é zero real, formatação textual nunca é divergência.
 */
import { parseGradeToken } from './normalize';

/** Flags de reconciliação — sempre recalculadas, nunca preservadas de estado antigo. */
export const RECONCILIATION_FLAGS = ['reconciliation_divergence', 'reconciled_match'];

/** Remove flags de reconciliação obsoletas de uma lista de flags. */
export const stripReconciliationFlags = (flags: string[] | undefined | null): string[] =>
  (flags ?? []).filter((f) => !RECONCILIATION_FLAGS.includes(f));

/** Parse tolerante de `second_pass_value` (IA). Vazio, `—`, `-`, null => null. */
export const parseSecondPassValue = (raw: string | null | undefined): number | null =>
  parseGradeToken(raw ?? null).value;

/** 7,5 == 7,50; 8 == 8,00; 0 == 0,00; null == vazio; null != 0. */
export const sameGradeValue = (a: number | null, b: number | null): boolean => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
};

/** Verdadeiro quando o valor atual da linha é semanticamente igual à 2ª leitura. */
export const matchesSecondPass = (
  value: number | null,
  secondPassValue: string | null | undefined,
): boolean => sameGradeValue(value, parseSecondPassValue(secondPassValue));
