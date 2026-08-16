/**
 * Matriz curricular efetiva da turma (Fase 3).
 * Une, nesta prioridade: mapeamento acadêmico da turma > disciplinas já importadas >
 * catálogo global da série. Aliases e abreviações do catálogo enriquecem as âncoras.
 */
import { normalizeText } from './normalize';
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
  /** Série da turma (1º, 2º, 3º ano). Quando nula, o catálogo entra apenas como enriquecimento. */
  series?: string | null;
}

const seriesMatches = (series: string | null | undefined, list: string[] | null | undefined) => {
  if (!series || !list || list.length === 0) return false;
  const target = normalizeText(series);
  return list.some((s) => normalizeText(s) === target);
};

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