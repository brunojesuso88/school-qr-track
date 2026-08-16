/**
 * Âncoras de disciplina (Fase 3): a matriz curricular da turma passa a ser referência
 * determinística para o parser local reconhecer linhas de disciplina.
 *
 * Nada aqui cria nota: a âncora só diz "esta linha é a disciplina X".
 */
import { canonicalSubjectKey, normalizeText, similarity } from './normalize';
import { LocalExpectedSubject } from './types';

export interface SubjectAnchor {
  /** Nome canônico (como cadastrado na matriz da turma / catálogo). */
  canonical: string;
  /** Chaves normalizadas de igualdade: nome + aliases. */
  keys: string[];
  /** Abreviação normalizada (igualdade exata apenas). */
  abbreviation: string | null;
  weekly_classes: number | null;
}

export type AnchorMatchKind = 'exact' | 'alias' | 'abbreviation' | 'contains' | 'similar';

export interface AnchorMatch {
  anchor: SubjectAnchor;
  kind: AnchorMatchKind;
  /** 1 para igualdade; < 1 para prefixo/semelhança. */
  score: number;
}

export const ANCHOR_MIN_SIMILARITY = 0.82;

/** Constrói o índice de âncoras a partir das disciplinas esperadas da turma. */
export function buildSubjectAnchors(expected: LocalExpectedSubject[]): SubjectAnchor[] {
  const byCanonical = new Map<string, SubjectAnchor>();
  for (const item of expected) {
    const canonical = String(item?.name ?? '').trim();
    if (!canonical) continue;
    const key = canonicalSubjectKey(canonical);
    if (!key) continue;
    const existing = byCanonical.get(key);
    const aliasKeys = (item.aliases ?? [])
      .map((a) => canonicalSubjectKey(a))
      .filter((a) => a.length >= 3);
    const abbreviation = item.abbreviation ? normalizeText(item.abbreviation) : null;
    if (existing) {
      existing.keys = [...new Set([...existing.keys, ...aliasKeys])];
      existing.abbreviation = existing.abbreviation ?? (abbreviation || null);
      existing.weekly_classes = existing.weekly_classes ?? (item.weekly_classes ?? null);
      continue;
    }
    byCanonical.set(key, {
      canonical,
      keys: [...new Set([key, ...aliasKeys])],
      abbreviation: abbreviation && abbreviation.length >= 2 ? abbreviation : null,
      weekly_classes: item.weekly_classes ?? null,
    });
  }
  return [...byCanonical.values()];
}

/**
 * Reconhece o texto de uma linha como disciplina da matriz.
 * Ordem: igualdade (nome/alias) -> abreviação -> prefixo/contém -> semelhança alta.
 * Ambiguidade (2+ candidatos plausíveis) NUNCA ancora.
 */
export function matchSubjectAnchor(
  text: string,
  anchors: SubjectAnchor[],
  minSimilarity = ANCHOR_MIN_SIMILARITY,
): AnchorMatch | null {
  const norm = canonicalSubjectKey(text);
  if (!norm || anchors.length === 0) return null;

  // 1) igualdade normalizada com nome ou alias
  const exact = anchors.filter((a) => a.keys.includes(norm));
  if (exact.length === 1) {
    const anchor = exact[0];
    const kind: AnchorMatchKind = canonicalSubjectKey(anchor.canonical) === norm ? 'exact' : 'alias';
    return { anchor, kind, score: 1 };
  }
  if (exact.length > 1) return null;

  // 2) abreviação (igualdade exata)
  const abbr = anchors.filter((a) => a.abbreviation && a.abbreviation === norm);
  if (abbr.length === 1) return { anchor: abbr[0], kind: 'abbreviation', score: 1 };
  if (abbr.length > 1) return null;

  // 3) prefixo / contém — só com candidato único e texto suficientemente longo
  if (norm.length >= 4) {
    const contains = anchors.filter((a) => a.keys.some((k) =>
      k.length >= 4 && (k.startsWith(norm) || norm.startsWith(k) || k.includes(norm) || norm.includes(k))));
    if (contains.length === 1) return { anchor: contains[0], kind: 'contains', score: 0.9 };
    if (contains.length > 1) return null;
  }

  // 4) semelhança alta com candidato ÚNICO acima do limiar
  const scored = anchors
    .map((a) => ({ anchor: a, score: Math.max(...a.keys.map((k) => similarity(norm, k))) }))
    .filter((s) => s.score >= minSimilarity)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 1) return { anchor: scored[0].anchor, kind: 'similar', score: scored[0].score };
  return null;
}

/** Confiança da célula materializada por âncora: igualdade = 1; aproximação = 0,85. */
export const anchorConfidence = (kind: AnchorMatchKind) =>
  (kind === 'exact' || kind === 'alias' || kind === 'abbreviation' ? 1 : 0.85);