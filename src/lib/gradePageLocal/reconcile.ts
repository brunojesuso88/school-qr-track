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
  source?: string;
  second_pass_value?: string | null;
}

interface AnyPreview {
  rows: AnyRow[];
  reading?: { mode?: string; escalated?: boolean; reasons?: string[]; [k: string]: unknown };
  stats?: Record<string, number>;
  notes?: string[];
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
export function reconcileLocalWithAi<T>(local: T, ai: AnyPreview): ReconcileResult<T> {
  const base = local as unknown as AnyPreview;
  const aiByKey = new Map<string, AnyRow>();
  (ai.rows || []).forEach((r) => aiByKey.set(cellKey(r), r));

  let divergences = 0;
  const rows: AnyRow[] = (base.rows || []).map((row) => {
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
    ...base,
    rows,
    notes: [...new Set([...(base.notes ?? []), ...(ai.notes ?? [])])].slice(0, 10),
    stats: {
      ...(base.stats ?? {}),
      cells_total: rows.length,
      grades_read: rows.filter((r) => r.value != null).length,
      empty_cells: rows.filter((r) => r.value == null && !(r.flags ?? []).includes('invalid_value')).length,
      explicit_zero_cells: rows.filter((r) => r.value === 0).length,
      invalid_values: rows.filter((r) => (r.flags ?? []).includes('invalid_value')).length,
      low_confidence: rows.filter((r) => (r.flags ?? []).includes('low_confidence')).length,
    },
    reading: {
      ...(base.reading ?? {}),
      mode: 'local_validated',
      escalated: true,
      divergences,
    },
  } as unknown as T;

  return { preview, divergences };
}