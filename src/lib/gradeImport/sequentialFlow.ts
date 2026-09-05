/**
 * ORDEM ESTRITA da importação de boletim (regra de integridade).
 *
 * Regras invioláveis:
 *  - falha bloqueante na página N NUNCA avança para N+1: a sessão fica parada em
 *    N até que N seja resolvida (confirmada ou ignorada por regra segura);
 *  - a pré-leitura local de N+1/N+2 pode continuar em memória, mas nunca
 *    persiste nada nem libera confirmação de página posterior;
 *  - a sessão só pode virar `completed` (e só então `pdf_base64` é limpo) quando
 *    NÃO existe página pendente/erro;
 *  - `onImported` não é chamado enquanto houver falha pendente na sessão.
 */

import { classifyPageFailure, type PageFailure } from './failureQueue';

/** Status de página já resolvidos: nunca são reprocessados nem alterados. */
export const RESOLVED_PAGE_STATUSES = ['confirmed', 'ignored'] as const;

export interface SessionPageRow {
  page_number: number;
  status: string;
  error?: string | null;
  preview_json?: unknown;
}

export const isResolvedPageStatus = (status: string): boolean =>
  (RESOLVED_PAGE_STATUSES as readonly string[]).includes(status);

/**
 * Primeira página ainda não resolvida (retomada após refresh). Páginas
 * `confirmed`/`ignored` ficam intocadas; `error` volta a ser a próxima da fila.
 */
export const firstUnresolvedPage = (rows: SessionPageRow[]): number | null => {
  const pending = [...rows]
    .filter((r) => !isResolvedPageStatus(r.status))
    .sort((a, b) => a.page_number - b.page_number);
  return pending[0]?.page_number ?? null;
};

/** Reconstrói a lista de falhas a partir das páginas gravadas como `error`. */
export const failuresFromRows = (rows: SessionPageRow[], now = Date.now()): PageFailure[] =>
  [...rows]
    .filter((r) => r.status === 'error')
    .sort((a, b) => a.page_number - b.page_number)
    .map((r) => {
      const { reason, message } = classifyPageFailure(r.error ?? '');
      return {
        page: r.page_number,
        reason,
        message: r.error || message,
        localPreview: r.preview_json ?? null,
        attempts: 1,
        at: now,
      };
    });

export type AdvanceAction =
  | { action: 'next'; page: number }
  | { action: 'retry_pending'; page: number }
  | { action: 'finish' };

/**
 * Decide o próximo passo depois de uma página RESOLVIDA. Enquanto existir
 * página com falha, a sessão nunca é finalizada: volta para a falha mais antiga.
 */
export const resolveAdvance = (input: {
  currentPage: number;
  totalPages: number;
  pendingFailurePages: number[];
}): AdvanceAction => {
  const pending = [...input.pendingFailurePages].filter((p) => p !== input.currentPage).sort((a, b) => a - b);
  if (input.currentPage < input.totalPages) {
    const earlier = pending.find((p) => p < input.currentPage);
    if (earlier != null) return { action: 'retry_pending', page: earlier };
    return { action: 'next', page: input.currentPage + 1 };
  }
  if (pending.length > 0) return { action: 'retry_pending', page: pending[0] };
  return { action: 'finish' };
};

/** Só é permitido finalizar (completed + limpar PDF) sem nenhuma falha pendente. */
export const canFinishSession = (pendingFailurePages: number[]): boolean =>
  pendingFailurePages.length === 0;

/**
 * Falha de leitura/IA na página N: a sessão PARA em N. Nenhum avanço automático,
 * nenhuma outra página é processada ou gravada por conta desta falha.
 */
export const failureFlow = (page: number): { action: 'hold'; page: number; advance: false } => ({
  action: 'hold',
  page,
  advance: false,
});
