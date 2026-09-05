/**
 * Cache EM MEMÓRIA dos DESTINOS acadêmicos da importação de boletim:
 * `grade_subjects` e `grade_periods` já existentes na turma.
 *
 * Regras:
 *  - chave obrigatória `school_id + class_id + matrix_id`: nada é reaproveitado
 *    entre escolas, turmas ou matrizes diferentes;
 *  - carregado UMA vez por sessão de importação e atualizado imediatamente após
 *    cada upsert bem-sucedido (nenhum SELECT completo por página);
 *  - `students` NUNCA entram aqui (aluno pode ser criado/movido durante a sessão);
 *  - identidade da disciplina é sempre `normalized_name + slot_index` (ocorrências
 *    repetidas da Matriz Integral são linhas distintas);
 *  - `weekly_classes`, `include_in_ira`, `custom_ira_weight` e `legacy_excluded`
 *    são preservados exatamente como vêm do banco.
 */

export interface TargetSubjectRow {
  id: string;
  name: string;
  normalized_name: string;
  slot_index: number | null;
  include_in_ira: boolean;
  custom_ira_weight: number | null;
  legacy_excluded: boolean | null;
  weekly_classes: number | null;
}

export interface TargetPeriodRow {
  id: string;
  normalized_label: string;
}

export interface ImportTargets {
  subjects: TargetSubjectRow[];
  periods: TargetPeriodRow[];
}

export interface TargetCacheKeyParts {
  schoolId: string;
  classId: string;
  matrixId: string | null | undefined;
}

export const targetCacheKey = ({ schoolId, classId, matrixId }: TargetCacheKeyParts): string =>
  `${schoolId}::${classId}::${matrixId ?? 'no-matrix'}`;

/** Identidade canônica de destino: disciplina + ocorrência (slot). */
export const subjectSlotKey = (normalizedName: string, slotIndex?: number | null): string =>
  `${normalizedName}#${slotIndex ?? 1}`;

export class ImportTargetCache {
  private key: string | null = null;
  private subjects = new Map<string, TargetSubjectRow>();
  private periods = new Map<string, TargetPeriodRow>();
  private loaded = false;
  /** SELECTs completos efetivamente executados. */
  private selects = 0;
  /** SELECTs completos evitados pelo cache (métrica local). */
  private saved = 0;

  /**
   * Garante os destinos da turma em memória. O `loader` (SELECT completo) só é
   * chamado quando o cache está vazio ou a chave school+class+matrix mudou.
   */
  async ensure(key: string, loader: () => Promise<ImportTargets>): Promise<{ fromCache: boolean }> {
    if (this.key !== key) this.reset(key);
    if (this.loaded) { this.saved += 1; return { fromCache: true }; }
    const targets = await loader();
    this.selects += 1;
    this.subjects = new Map(targets.subjects.map((s) => [subjectSlotKey(s.normalized_name, s.slot_index), s]));
    this.periods = new Map(targets.periods.map((p) => [p.normalized_label, p]));
    this.loaded = true;
    return { fromCache: false };
  }

  /** Descarta tudo e passa a valer para a nova chave (troca de turma/escola/matriz). */
  reset(key: string | null = null): void {
    this.key = key;
    this.subjects = new Map();
    this.periods = new Map();
    this.loaded = false;
  }

  get scopeKey(): string | null { return this.key; }
  get isLoaded(): boolean { return this.loaded; }

  subjectRows(key: string): TargetSubjectRow[] {
    if (this.key !== key || !this.loaded) return [];
    return [...this.subjects.values()];
  }

  subjectId(key: string, normalizedName: string, slotIndex?: number | null): string | undefined {
    if (this.key !== key) return undefined;
    return this.subjects.get(subjectSlotKey(normalizedName, slotIndex))?.id;
  }

  periodId(key: string, normalizedLabel: string): string | undefined {
    if (this.key !== key) return undefined;
    return this.periods.get(normalizedLabel)?.id;
  }

  periodIdMap(key: string): Map<string, string> {
    if (this.key !== key || !this.loaded) return new Map();
    return new Map([...this.periods.values()].map((p) => [p.normalized_label, p.id]));
  }

  /** Registra/atualiza uma disciplina recém-gravada (sem novo SELECT). */
  putSubject(key: string, row: TargetSubjectRow): void {
    if (this.key !== key) return;
    const slotKey = subjectSlotKey(row.normalized_name, row.slot_index);
    const previous = this.subjects.get(slotKey);
    this.subjects.set(slotKey, previous ? { ...previous, ...row } : row);
  }

  /** Registra/atualiza um período recém-gravado (sem novo SELECT). */
  putPeriod(key: string, row: TargetPeriodRow): void {
    if (this.key !== key) return;
    this.periods.set(row.normalized_label, row);
  }

  get stats(): { selects: number; selectsSaved: number; subjects: number; periods: number } {
    return { selects: this.selects, selectsSaved: this.saved, subjects: this.subjects.size, periods: this.periods.size };
  }
}
