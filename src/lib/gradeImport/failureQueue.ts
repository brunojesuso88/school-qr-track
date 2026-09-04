/**
 * Fila de páginas que FALHARAM na leitura (IA indisponível, rede, resposta
 * inválida) para reprocessamento ao final da sessão, sem abortar a importação.
 *
 * Regras:
 *  - página confirmada, ignorada em silêncio (sem disciplina) ou já resolvida
 *    localmente NUNCA entra na fila;
 *  - a falha guarda a prévia local, quando houver: no reprocessamento a leitura
 *    local já feita é reaproveitada;
 *  - a fila é em memória, por sessão; nenhum dado acadêmico é gravado por ela.
 */

export type PageFailureReason =
  | 'ai_rate_limited'
  | 'ai_payment_required'
  | 'ai_timeout'
  | 'ai_network'
  | 'ai_invalid_response'
  | 'ai_error'
  | 'local_error'
  | 'unknown';

export interface PageFailure {
  page: number;
  reason: PageFailureReason;
  message: string;
  /** Prévia local disponível no momento da falha (reaproveitada no retry). */
  localPreview: unknown | null;
  attempts: number;
  at: number;
}

const REASON_LABEL: Record<PageFailureReason, string> = {
  ai_rate_limited: 'limite de uso da leitura por IA atingido',
  ai_payment_required: 'créditos de IA esgotados',
  ai_timeout: 'a leitura por IA demorou demais',
  ai_network: 'falha de conexão ao ler a página',
  ai_invalid_response: 'a IA devolveu uma resposta inválida',
  ai_error: 'erro na leitura por IA',
  local_error: 'falha na leitura local da página',
  unknown: 'falha inesperada na leitura',
};

export const pageFailureLabel = (reason: PageFailureReason): string => REASON_LABEL[reason] ?? REASON_LABEL.unknown;

/** Classifica a falha de leitura em uma causa acionável para o usuário. */
export const classifyPageFailure = (error: unknown): { reason: PageFailureReason; message: string } => {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const status = (error as { status?: number; code?: number } | null)?.status
    ?? (error as { code?: number } | null)?.code;
  const text = raw.toLowerCase();
  if (status === 429 || text.includes('429') || text.includes('rate limit')) {
    return { reason: 'ai_rate_limited', message: raw || 'Limite de leituras por IA atingido.' };
  }
  if (status === 402 || text.includes('402') || text.includes('payment required') || text.includes('credit')) {
    return { reason: 'ai_payment_required', message: raw || 'Créditos de IA esgotados.' };
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('abort')) {
    return { reason: 'ai_timeout', message: raw || 'A leitura por IA excedeu o tempo limite.' };
  }
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('econn')) {
    return { reason: 'ai_network', message: raw || 'Falha de conexão durante a leitura.' };
  }
  if (text.includes('json') || text.includes('parse') || text.includes('invalid response')) {
    return { reason: 'ai_invalid_response', message: raw || 'Resposta inválida da leitura por IA.' };
  }
  if (text.includes('local')) return { reason: 'local_error', message: raw };
  if (!raw) return { reason: 'unknown', message: 'Falha inesperada na leitura da página.' };
  return { reason: 'ai_error', message: raw };
};

export class PageFailureQueue {
  private readonly failures = new Map<number, PageFailure>();
  private readonly resolvedPages = new Set<number>();

  /** Registra (ou reincide) a falha de uma página que ainda pode ser reprocessada. */
  record(input: { page: number; error: unknown; localPreview?: unknown | null; now?: number }): PageFailure {
    const { reason, message } = classifyPageFailure(input.error);
    const previous = this.failures.get(input.page);
    const failure: PageFailure = {
      page: input.page,
      reason,
      message,
      localPreview: input.localPreview ?? previous?.localPreview ?? null,
      attempts: (previous?.attempts ?? 0) + 1,
      at: input.now ?? Date.now(),
    };
    this.resolvedPages.delete(input.page);
    this.failures.set(input.page, failure);
    return failure;
  }

  /** Página resolvida (confirmada, ignorada ou relida com sucesso). */
  resolve(page: number): void {
    this.failures.delete(page);
    this.resolvedPages.add(page);
  }

  has(page: number): boolean { return this.failures.has(page); }
  get(page: number): PageFailure | null { return this.failures.get(page) ?? null; }
  list(): PageFailure[] { return [...this.failures.values()].sort((a, b) => a.page - b.page); }
  get size(): number { return this.failures.size; }
  clear(): void { this.failures.clear(); this.resolvedPages.clear(); }

  /** Páginas a reprocessar: falhas ainda não resolvidas, em ordem. */
  pendingPages(exclude: { confirmed?: number[]; ignored?: number[] } = {}): number[] {
    const skip = new Set([...(exclude.confirmed ?? []), ...(exclude.ignored ?? []), ...this.resolvedPages]);
    return this.list().filter((f) => !skip.has(f.page)).map((f) => f.page);
  }
}

/** Resumo em linguagem simples das páginas que ficaram para reprocessar. */
export const formatPageFailures = (failures: PageFailure[]): string => {
  if (failures.length === 0) return 'Nenhuma página ficou pendente de releitura.';
  const parts = failures.map((f) => `página ${f.page} (${pageFailureLabel(f.reason)})`);
  return `${failures.length} página(s) para reprocessar: ${parts.join('; ')}`;
};
