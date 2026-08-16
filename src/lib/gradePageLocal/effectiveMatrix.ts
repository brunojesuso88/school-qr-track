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
  mapping, imported = [], catalog = [], series = null,
}: BuildEffectiveMatrixInput): LocalExpectedSubject[] {
  const result = new Map<string, LocalExpectedSubject>();

  const add = (
    name: string,
    weekly: number | null | undefined,
    origin: 'mapping' | 'grade' | 'catalog',
  ) => {
    const clean = String(name ?? '').trim();
    const key = normalizeText(clean);
    if (!clean || !key) return;
    const existing = result.get(key);
    if (existing) {
      existing.weekly_classes = existing.weekly_classes ?? (weekly ?? null);
      existing.origin = [...new Set([...(existing.origin ?? []), origin])];
      return;
    }
    result.set(key, { name: clean, weekly_classes: weekly ?? null, aliases: [], origin: [origin] });
  };

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