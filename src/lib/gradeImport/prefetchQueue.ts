/**
 * Fila de PRÉ-LEITURA local (pdf.js) das próximas páginas do boletim.
 *
 * Objetivo: enquanto o usuário confere a página N, as páginas N+1..N+lookahead
 * já são lidas localmente, em segundo plano e com concorrência limitada.
 *
 * Regras:
 *  - a fila é sempre atrelada a um escopo (`sessionId`); trocar de sessão/turma
 *    descarta tudo (nunca reaproveita leitura de outro documento);
 *  - a pré-leitura NUNCA chama a IA nem grava no banco: é só leitura local;
 *  - se a página pedida já estiver pronta, ela é reaproveitada; senão a leitura
 *    acontece na hora, exatamente como antes;
 *  - falha na pré-leitura não é erro de importação: é descartada em silêncio e a
 *    leitura normal acontece quando a página chegar.
 */

export interface PrefetchQueueOptions<T> {
  read: (page: number) => Promise<T>;
  /** Leituras locais simultâneas em segundo plano. */
  maxConcurrency?: number;
  /** Quantas páginas à frente manter prontas. */
  lookahead?: number;
}

interface Entry<T> {
  promise: Promise<T | null>;
  settled: boolean;
  failed: boolean;
}

export class LocalPrefetchQueue<T> {
  private scope: string | null = null;
  private entries = new Map<number, Entry<T>>();
  private pending: number[] = [];
  private running = 0;
  private reused = 0;
  private started = 0;
  private discarded = 0;

  constructor(private readonly options: PrefetchQueueOptions<T>) {}

  private get maxConcurrency(): number { return Math.max(1, this.options.maxConcurrency ?? 2); }
  private get lookahead(): number { return Math.max(0, this.options.lookahead ?? 2); }

  /** Define o escopo (sessão). Escopo diferente descarta a fila inteira. */
  setScope(scope: string | null): void {
    if (this.scope === scope) return;
    this.scope = scope;
    this.clear();
  }

  get scopeKey(): string | null { return this.scope; }

  clear(): void {
    this.discarded += this.entries.size;
    this.entries.clear();
    this.pending = [];
  }

  /** Agenda a pré-leitura das próximas páginas a partir da página atual. */
  schedule(currentPage: number, totalPages: number): void {
    if (this.lookahead === 0) return;
    for (let page = currentPage + 1; page <= Math.min(totalPages, currentPage + this.lookahead); page += 1) {
      if (this.entries.has(page) || this.pending.includes(page)) continue;
      this.pending.push(page);
    }
    this.pump();
  }

  private pump(): void {
    while (this.running < this.maxConcurrency && this.pending.length > 0) {
      const page = this.pending.shift() as number;
      const scopeAtStart = this.scope;
      this.running += 1;
      this.started += 1;
      const entry: Entry<T> = { settled: false, failed: false, promise: Promise.resolve(null) };
      entry.promise = this.options.read(page)
        .then((value) => {
          entry.settled = true;
          // Escopo mudou no meio: o resultado não vale mais.
          return this.scope === scopeAtStart ? value : null;
        })
        .catch(() => { entry.settled = true; entry.failed = true; return null; })
        .finally(() => { this.running -= 1; this.pump(); });
      this.entries.set(page, entry);
    }
  }

  /** Já existe leitura pronta ou em andamento para esta página? */
  has(page: number): boolean { return this.entries.has(page); }

  /**
   * Consome a leitura da página: reaproveita a pré-leitura quando existir e for
   * bem-sucedida, senão lê agora.
   */
  async take(page: number): Promise<{ value: T; reused: boolean }> {
    const entry = this.entries.get(page);
    this.entries.delete(page);
    if (entry) {
      const value = await entry.promise;
      if (value != null && !entry.failed) {
        this.reused += 1;
        return { value, reused: true };
      }
    }
    return { value: await this.options.read(page), reused: false };
  }

  /** Descarta páginas já passadas (a importação nunca volta atrás). */
  prune(currentPage: number): void {
    for (const page of [...this.entries.keys()]) {
      if (page <= currentPage) { this.entries.delete(page); this.discarded += 1; }
    }
    this.pending = this.pending.filter((page) => page > currentPage);
  }

  get stats(): { reusedPages: number; startedPages: number; readyPages: number; discardedPages: number } {
    return {
      reusedPages: this.reused,
      startedPages: this.started,
      readyPages: [...this.entries.values()].filter((e) => e.settled && !e.failed).length,
      discardedPages: this.discarded,
    };
  }
}
