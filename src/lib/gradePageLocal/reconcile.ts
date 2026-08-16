/**
 * Reconciliação LOCAL × IA. A IA é validadora: nunca sobrescreve a leitura local.
 * Divergência => flag `reconciliation_divergence`, valor local visível e valor da IA em `second_pass_value`.
 */
import { isEmptyMarker, normalizeText } from './normalize';
import { sameGradeValue, stripReconciliationFlags } from './gradeCompare';

export interface ReconcilePolicy {
  /**
   * Leitura local é fonte de verdade: divergências da IA viram AVISO
   * (`ai_validation_disagreement`) e nunca bloqueiam a confirmação manual.
   */
  localAuthoritative?: boolean;
}

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

const sameValue = sameGradeValue;

const cellKey = (r: AnyRow) => `${normalizeText(r.subject)}||${normalizeText(r.period)}`;

/** Célula da IA sem nota: vazio, `—`, `null`. Nunca representa uma nota. */
const isEmptyAiCell = (r: AnyRow) => {
  if (r.value != null) return false;
  const raw = (r.raw_value ?? '').trim();
  return raw === '' || isEmptyMarker(raw);
};

export interface ReconcileResult<T> {
  preview: T;
  divergences: number;
  /** Células vazias que só a IA listou e foram descartadas (não bloqueiam). */
  aiEmptyIgnored: number;
  /** Notas numéricas que só a IA viu e foram descartadas por autoridade local. */
  aiOnlyNumericIgnored: number;
}

/** Mantém a estrutura da prévia LOCAL e apenas anota a comparação com a leitura da IA. */
export function reconcileLocalWithAi<T>(local: T, ai: AnyPreview, policy: ReconcilePolicy = {}): ReconcileResult<T> {
  const base = local as unknown as AnyPreview;
  const authoritative = policy.localAuthoritative === true;
  const divergenceFlag = authoritative ? 'ai_validation_disagreement' : 'reconciliation_divergence';
  const aiByKey = new Map<string, AnyRow>();
  (ai.rows || []).forEach((r) => aiByKey.set(cellKey(r), r));

  let divergences = 0;
  let aiEmptyIgnored = 0;
  let aiOnlyNumericIgnored = 0;
  const rows: AnyRow[] = (base.rows || []).map((row) => {
    const key = cellKey(row);
    const aiRow = aiByKey.get(key);
    aiByKey.delete(key);
    // Estado de reconciliação anterior nunca é preservado: sempre recalculado.
    const flags = new Set(stripReconciliationFlags(row.flags));
    if (!aiRow) return { ...row, flags: [...flags] };
    if (sameValue(row.value ?? null, aiRow.value ?? null)) {
      flags.add('reconciled_match');
      return { ...row, flags: [...flags], second_pass_value: aiRow.raw_value ?? null };
    }
    divergences++;
    flags.add(divergenceFlag);
    // valor LOCAL permanece visível; o da IA vai para diagnóstico/2ª leitura
    return { ...row, flags: [...flags], second_pass_value: aiRow.raw_value ?? '—' };
  });

  // Células que só a IA viu:
  // - sem nota (vazio/`—`) => descartadas: a IA não pode criar disciplina vazia inexistente;
  // - com nota numérica e leitura local NÃO autoritativa => revisão humana obrigatória;
  // - com nota numérica e leitura local AUTORITATIVA => descartada (IA nunca cria nota).
  aiByKey.forEach((aiRow) => {
    if (isEmptyAiCell(aiRow)) { aiEmptyIgnored++; return; }
    if (authoritative) { aiOnlyNumericIgnored++; return; }
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
      authority: authoritative ? 'authoritative' : 'needs_validation',
      ai_used: true,
      divergences,
      ai_empty_ignored: aiEmptyIgnored,
      ai_only_numeric_ignored: aiOnlyNumericIgnored,
    },
  } as unknown as T;

  return { preview, divergences, aiEmptyIgnored, aiOnlyNumericIgnored };
}