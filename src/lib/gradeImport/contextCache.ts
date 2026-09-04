/**
 * Cache EM MEMÓRIA (por sessão do navegador) do contexto estático do importador:
 * matriz curricular efetiva, catálogo de disciplinas e mapeamento da turma.
 * Chave: school_id + class_id + matrix_id. Alunos NUNCA entram no cache
 * (mudam durante a importação: vínculo, criação, troca de turma).
 * Sem analytics externo — apenas Map local.
 */

export interface ContextCacheKeyParts {
  schoolId: string;
  classId: string;
  matrixId: string | null | undefined;
}

export const contextCacheKey = ({ schoolId, classId, matrixId }: ContextCacheKeyParts): string =>
  `${schoolId}::${classId}::${matrixId ?? 'no-matrix'}`;

interface Entry<T> { value: T; storedAt: number }

export class ImportContextCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly maxAgeMs: number = 10 * 60_000, private readonly now: () => number = () => Date.now()) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) { this.misses += 1; return null; }
    if (this.now() - entry.storedAt > this.maxAgeMs) {
      this.entries.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, storedAt: this.now() });
  }

  /** Invalida uma chave exata ou todas as chaves que começam com o prefixo. */
  invalidate(keyOrPrefix?: string): number {
    if (!keyOrPrefix) { const n = this.entries.size; this.entries.clear(); return n; }
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) { this.entries.delete(key); removed += 1; }
    }
    return removed;
  }

  get size(): number { return this.entries.size; }
  get stats(): { hits: number; misses: number } { return { hits: this.hits, misses: this.misses }; }
}
