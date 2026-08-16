/**
 * Reconciliação LOCAL × IA. A IA é validadora: nunca sobrescreve a leitura local.
 * Divergência => flag `reconciliation_divergence`, valor local visível e valor da IA em `second_pass_value`.
 */
import { normalizeText } from './normalize';

interface AnyRow {
  subject: string;
  period: string;
  raw_value: string | null;
  value: number | null;
  flags?: string[];
  [key: string]: unknown;
}

interface AnyPreview {
  rows: AnyRow[];
  reading?: Record<string, unknown>;
  subjects?: unknown[];
  periods?: unknown[];
  stats?: Record<string, number>;
  notes?: string[];
  [key: string]: unknown;
}

const sameValue = (a: number | null, b: number | null) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
};

const cellKey = (r: AnyRow) => `${normalizeText(r.subject)}||${normalizeText(r.period)}`;

export interface ReconcileResult<T> {
  preview: T;
  divergences: number;
}

/** Mantém a estrutura da prévia LOCAL e apenas anota a comparação com a leitura da IA. */
export function reconcileLocalWithAi<T extends AnyPreview>(local: T, ai: AnyPreview): ReconcileResult<T> {
  const aiByKey = new Map<string, AnyRow>();
  (ai.rows || []).forEach((r) => aiByKey.set(cellKey(r), r));

  let divergences = 0;
  const rows: AnyRow[] = (local.rows || []).map((row) => {
    const key = cellKey(row);
    const aiRow = aiByKey.get(key);
    aiByKey.delete(key);
    const flags = new Set(row.flags ?? []);
    if (!aiRow) return { ...row, flags: [...flags] };
    if (sameValue(row.value ?? null, aiRow.value ?? null)) {
      flags.add('reconciled_match');
      return { ...row, flags: [...flags], second_pass_value: aiRow.raw_value ?? null };
    }
    divergences++;
    flags.add('reconciliation_divergence');
    // valor LOCAL permanece visível; o da IA vai para diagnóstico/2ª leitura
    return { ...row, flags: [...flags], second_pass_value: aiRow.raw_value ?? '—' };
  });

  // Células que só a IA viu entram como linhas divergentes para revisão humana.
  aiByKey.forEach((aiRow) => {
    divergences++;
    rows.push({
      ...aiRow,
      source: 'ai',
      second_pass_value: aiRow.raw_value ?? '—',
      flags: [...new Set([...(aiRow.flags ?? []), 'reconciliation_divergence'])],
    });
  });

  const preview = {
    ...local,
    rows,
    notes: [...new Set([...(local.notes ?? []), ...(ai.notes ?? [])])].slice(0, 10),
    stats: {
      ...(local.stats ?? {}),
      cells_total: rows.length,
      grades_read: rows.filter((r) => r.value != null).length,
      empty_cells: rows.filter((r) => r.value == null && !(r.flags ?? []).includes('invalid_value')).length,
      explicit_zero_cells: rows.filter((r) => r.value === 0).length,
      invalid_values: rows.filter((r) => (r.flags ?? []).includes('invalid_value')).length,
      low_confidence: rows.filter((r) => (r.flags ?? []).includes('low_confidence')).length,
    },
    reading: {
      ...(local.reading ?? {}),
      mode: 'local_validated',
      escalated: true,
      divergences,
    },
  } as unknown as T;

  return { preview, divergences };
}