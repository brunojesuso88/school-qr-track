/**
 * Política CENTRAL de uso da IA no importador de boletim.
 *
 * Toda chamada a `parse-grade-page` passa por `decideAiFallback`. Condições que
 * acionam a IA (classificadas):
 *   - `ai_only_mode`        modo "Somente IA" escolhido pelo usuário;
 *   - `always_ai_mode`      modo "Sempre validar com IA";
 *   - `no_local_document`   PDF não pôde ser aberto no navegador;
 *   - `local_failed`        leitura local lançou exceção;
 *   - `local_not_ok`        leitura local não produziu prévia utilizável;
 *   - `local_needs_validation` prévia local existe, mas com bloqueantes.
 * Quando a leitura local é conclusiva (`local_conclusive`) a IA NÃO é chamada.
 */
import { ReadingModeName, shouldValidateWithAi } from '@/components/grades/gradesManualConfirm';

export type AiDecisionReason =
  | 'ai_only_mode'
  | 'always_ai_mode'
  | 'no_local_document'
  | 'local_failed'
  | 'local_not_ok'
  | 'local_needs_validation'
  | 'local_conclusive';

export type ReadingOrigin = 'local_conclusive' | 'local_validated' | 'ai_fallback' | 'ai_only';

export interface LocalResultLike {
  ok: boolean;
  authoritative: boolean;
  preview: unknown | null;
  validation?: { reasons?: string[]; score?: number };
  reading?: { blockers?: string[] } | null;
}

export interface AiFallbackContext {
  mode: ReadingModeName;
  /** O PDF foi aberto localmente (pdf.js) e há tokens da página. */
  hasLocalDocument: boolean;
  /** A leitura local lançou exceção. */
  localError?: boolean;
}

export interface AiFallbackDecision {
  useAi: boolean;
  reason: AiDecisionReason;
  origin: ReadingOrigin;
  /** Motivos/bloqueantes que justificam a decisão (para exibir ao usuário). */
  details: string[];
}

export const decideAiFallback = (
  local: LocalResultLike | null | undefined,
  context: AiFallbackContext,
): AiFallbackDecision => {
  if (context.mode === 'ai_only') {
    return { useAi: true, reason: 'ai_only_mode', origin: 'ai_only', details: [] };
  }
  const details = [
    ...(local?.validation?.reasons ?? []),
    ...(local?.reading?.blockers ?? []),
  ].filter((v, i, arr) => !!v && arr.indexOf(v) === i);
  if (!context.hasLocalDocument) {
    return { useAi: true, reason: 'no_local_document', origin: 'ai_fallback', details };
  }
  if (context.localError) {
    return { useAi: true, reason: 'local_failed', origin: 'ai_fallback', details };
  }
  const localOk = !!local && local.ok && local.preview != null;
  const localAuthoritative = !!local && local.authoritative;
  if (context.mode === 'always_ai') {
    return {
      useAi: true,
      reason: 'always_ai_mode',
      origin: localOk ? 'local_validated' : 'ai_fallback',
      details,
    };
  }
  const useAi = shouldValidateWithAi({ mode: context.mode, localOk, localAuthoritative });
  if (!useAi) return { useAi: false, reason: 'local_conclusive', origin: 'local_conclusive', details: [] };
  if (!localOk) return { useAi: true, reason: 'local_not_ok', origin: 'ai_fallback', details };
  return { useAi: true, reason: 'local_needs_validation', origin: 'local_validated', details };
};

export interface ReadingLike {
  mode: 'local' | 'local_validated' | 'ai_fallback' | 'fast' | 'validated' | string;
  ai_used?: boolean;
  escalated?: boolean;
  authority?: 'authoritative' | 'needs_validation';
}

/** Rótulo de origem exibido na página e no resumo. */
export const readingOriginLabel = (reading: ReadingLike | null | undefined): string => {
  if (!reading) return 'Origem da leitura não informada';
  switch (reading.mode) {
    case 'local':
      return reading.authority === 'needs_validation'
        ? 'Leitura local — requer conferência'
        : 'Leitura local — conclusiva';
    case 'local_validated':
      return 'Leitura local — validada por IA';
    case 'ai_fallback':
      return 'IA usada como fallback';
    case 'validated':
      return 'IA — validação adicional aplicada';
    case 'fast':
      return 'IA — leitura rápida';
    default:
      return reading.ai_used ? 'IA utilizada' : 'Leitura local';
  }
};

/** A página foi resolvida com IA (para métricas). */
export const readingUsedAi = (reading: ReadingLike | null | undefined): boolean =>
  !!reading && (reading.ai_used === true || ['local_validated', 'ai_fallback', 'fast', 'validated'].includes(reading.mode));
