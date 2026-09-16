/**
 * Regras puras de EDIÇÃO de ocorrências GERAIS (não Conselho de Classe).
 *
 * A autorização real vive no backend (policy "Autor edita suas ocorrencias" e a
 * policy de permissão `occurrences.edit`, ambas dentro de `can_access_school`);
 * estes helpers apenas espelham a regra na interface e garantem que o payload
 * de update nunca carregue campos imutáveis (id, escola, aluno, autor, criação).
 */

export interface OccurrenceAuthorLike {
  id: string;
  created_by?: string | null;
}

/** Autor da ocorrência OU quem já tem permissão administrativa de edição. */
export function canEditGeneralOccurrence(
  occurrence: OccurrenceAuthorLike,
  userId: string | null | undefined,
  hasEditPermission: boolean,
): boolean {
  if (hasEditPermission) return true;
  if (!userId) return false;
  return occurrence.created_by === userId;
}

export interface GeneralOccurrenceDraft {
  type: string;
  description: string | null;
  date: string;
  endDate?: string | null;
}

export interface GeneralOccurrenceUpdate {
  type: string;
  description: string | null;
  date: string;
  end_date: string | null;
}

/** Somente campos editáveis. Nunca inclui id/school_id/student_id/created_by/created_at. */
export function buildGeneralOccurrenceUpdate(draft: GeneralOccurrenceDraft): GeneralOccurrenceUpdate {
  return {
    type: draft.type,
    description: draft.description ?? null,
    date: draft.date,
    end_date: draft.endDate ?? null,
  };
}
