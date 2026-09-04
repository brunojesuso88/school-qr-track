/**
 * Matriz curricular efetiva da turma (Fase 3).
 * Une, nesta prioridade: mapeamento acadêmico da turma > disciplinas já importadas >
 * catálogo global da série. Aliases e abreviações do catálogo enriquecem as âncoras.
 */
import { normalizeText } from './normalize';
import { seriesListMatches } from '../series';
import { LocalExpectedSubject } from './types';

export interface CatalogSubject {
  name: string;
  abbreviation?: string | null;
  aliases?: string[] | null;
  series?: string[] | null;
  default_weekly_classes?: number | null;
}

interface BuildEffectiveMatrixInput {
  /**
   * Matriz curricular OFICIAL da série (`curriculum_matrix_subjects`).
   * Tem prioridade máxima: define nome canônico, aliases e carga da série.
   */
  matrix?: LocalExpectedSubject[];
  mapping: { name: string; weekly_classes?: number | null }[];
  imported?: { name: string; weekly_classes?: number | null }[];
  catalog?: CatalogSubject[];
  /** Série da turma como valor persistido ('1' | '2' | '3'). Nula => catálogo só enriquece. */
  series?: string | null;
}

/** Comparação canônica de série: '1'|'2'|'3', tolerando rótulos legados apenas na leitura. */
export const seriesMatches = (series: string | null | undefined, list: string[] | null | undefined) =>
  seriesListMatches(series, list);

/**
 * Disciplinas do catálogo da série que ainda NÃO existem no mapeamento da turma.
 * Nunca remove nem sobrescreve: disciplinas extras da turma e cargas horárias já
 * definidas permanecem intactas.
 */
export function selectMissingSeriesMatrixSubjects(
  series: string | null | undefined,
  catalog: CatalogSubject[],
  existing: { subject_name: string }[],
): CatalogSubject[] {
  const have = new Set((existing ?? []).map((e) => normalizeText(e.subject_name)));
  return (catalog ?? [])
    .filter((c) => seriesMatches(series, c.series ?? null))
    .filter((c) => !have.has(normalizeText(c.name)));
}

export function buildEffectiveSubjectMatrix({
  matrix = [], mapping, imported = [], catalog = [], series = null,
}: BuildEffectiveMatrixInput): LocalExpectedSubject[] {
  const result = new Map<string, LocalExpectedSubject>();

  const add = (
    name: string,
    weekly: number | null | undefined,
    origin: 'matrix' | 'mapping' | 'grade' | 'catalog',
    aliases: string[] = [],
    abbreviation: string | null = null,
    slot = 1,
  ) => {
    const clean = String(name ?? '').trim();
    const norm = normalizeText(clean);
    if (!clean || !norm) return;
    // Ocorrências (slots) do MESMO componente são entradas distintas da matriz efetiva.
    const key = `${norm}#${slot}`;
    const existing = result.get(key);
    if (existing) {
      existing.weekly_classes = existing.weekly_classes ?? (weekly ?? null);
      existing.origin = [...new Set([...(existing.origin ?? []), origin])];
      existing.aliases = [...new Set([...(existing.aliases ?? []), ...aliases])];
      existing.abbreviation = existing.abbreviation ?? abbreviation;
      return;
    }
    result.set(key, {
      name: clean, weekly_classes: weekly ?? null, slot_index: slot, aliases: [...aliases],
      abbreviation, origin: [origin],
    });
  };

  // 1) Matriz oficial da série: identidade e carga de referência.
  matrix.forEach((s) =>
    add(s.name, s.weekly_classes, 'matrix', s.aliases ?? [], s.abbreviation ?? null, s.slot_index ?? 1));
  mapping.forEach((s) => add(s.name, s.weekly_classes, 'mapping'));
  imported.forEach((s) => add(s.name, s.weekly_classes, 'grade'));
  // Catálogo só amplia a matriz quando a série está definida (herança determinística).
  catalog.forEach((c) => {
    if (seriesMatches(series, c.series)) add(c.name, c.default_weekly_classes, 'catalog');
  });

  // Enriquecimento: aliases/abreviação do catálogo aplicados por nome canônico ou alias.
  for (const entry of catalog) {
    const aliases = (entry.aliases ?? []).map((a) => String(a).trim()).filter(Boolean);
    const candidateKeys = [normalizeText(entry.name), ...aliases.map((a) => normalizeText(a))];
    for (const [key, subject] of result) {
      if (!candidateKeys.includes(key)) continue;
      subject.aliases = [...new Set([...(subject.aliases ?? []), entry.name, ...aliases])]
        .filter((a) => normalizeText(a) !== normalizeText(subject.name));
      subject.abbreviation = subject.abbreviation ?? (entry.abbreviation || null);
    }
  }

  return [...result.values()];
}