/**
 * Presets do Conselho de Classe (V1).
 *
 * As CHAVES são estáveis e persistidas em `occurrences.council_items` (text[]).
 * Rótulos podem evoluir; chaves não. Registros antigos (anteriores à coluna)
 * têm `council_items` vazio e continuam sendo renderizados pela observação livre.
 */

export const CLASS_COUNCIL_TYPE = 'class_council' as const;

export interface CouncilPreset {
  key: string;
  label: string;
}

export const COUNCIL_PRESETS: readonly CouncilPreset[] = [
  { key: 'no_classwork', label: 'Não realiza atividades em sala de aula' },
  { key: 'no_homework', label: 'Não realiza atividades de casa' },
  { key: 'infrequent', label: 'Aluno infrequente' },
] as const;

const PRESET_MAP: Record<string, string> = COUNCIL_PRESETS.reduce(
  (acc, p) => ({ ...acc, [p.key]: p.label }),
  {} as Record<string, string>,
);

/** Rótulo legível de uma chave; fallback para chaves desconhecidas/legadas. */
export const councilPresetLabel = (key: string): string => {
  const label = PRESET_MAP[key];
  if (label) return label;
  const cleaned = String(key ?? '').trim();
  if (!cleaned) return 'Item não identificado';
  // Fallback legível: "algum_item_novo" -> "Algum item novo"
  const spaced = cleaned.replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const isKnownCouncilPreset = (key: string): boolean => key in PRESET_MAP;

/** Normaliza a lista vinda do banco: remove vazios e duplicatas, preserva ordem. */
export const normalizeCouncilItems = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const key = raw.trim();
    if (!key || out.includes(key)) continue;
    out.push(key);
  }
  return out;
};

export interface CouncilDraft {
  items: string[];
  note: string;
}

export interface CouncilValidation {
  ok: boolean;
  items: string[];
  note: string | null;
  error?: string;
}

/**
 * Regra V1: é válido salvar com pelo menos 1 preset OU com observação livre.
 * Vazio (sem preset e sem observação) é rejeitado.
 */
export const validateCouncilDraft = (draft: CouncilDraft): CouncilValidation => {
  const items = normalizeCouncilItems(draft.items);
  const note = (draft.note ?? '').trim();

  if (items.length === 0 && note.length === 0) {
    return {
      ok: false,
      items,
      note: null,
      error: 'Selecione pelo menos um item do conselho ou escreva uma observação.',
    };
  }
  if (note.length > 1000) {
    return {
      ok: false,
      items,
      note: null,
      error: 'Observação muito longa (máximo 1000 caracteres).',
    };
  }
  return { ok: true, items, note: note.length > 0 ? note : null };
};

export interface CouncilLikeRecord {
  id: string;
  type: string;
  date: string;
}

/** Separação de escopo: Conselho de Classe vs ocorrências gerais. */
export const isCouncilOccurrence = (o: { type: string }): boolean =>
  o.type === CLASS_COUNCIL_TYPE;

export const splitOccurrences = <T extends { type: string }>(list: T[]) => ({
  general: list.filter((o) => !isCouncilOccurrence(o)),
  council: list.filter((o) => isCouncilOccurrence(o)),
});

/**
 * Duplicidade: registro de conselho do MESMO aluno na MESMA data.
 * Retorna o registro existente (para permitir editar em vez de criar outro).
 */
export const findCouncilDuplicate = <T extends CouncilLikeRecord>(
  list: T[],
  date: string,
  ignoreId?: string,
): T | null =>
  list.find(
    (o) => isCouncilOccurrence(o) && o.date === date && o.id !== ignoreId,
  ) ?? null;
