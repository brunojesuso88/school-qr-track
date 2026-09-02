/**
 * Camada canônica de ESCOPO DA ESCOLA ATIVA.
 *
 * Toda leitura/gravação de dado escolar deve passar por aqui, para que o filtro
 * por `school_id` seja explícito no frontend (defesa em profundidade sobre a RLS).
 */

export const NO_ACTIVE_SCHOOL_MESSAGE =
  'Nenhuma escola ativa selecionada. Escolha a escola no seletor antes de continuar.';

export class NoActiveSchoolError extends Error {
  constructor() {
    super(NO_ACTIVE_SCHOOL_MESSAGE);
    this.name = 'NoActiveSchoolError';
  }
}

/** Garante escola ativa antes de gravar. Lança erro claro em vez de gravar ambíguo. */
export function assertActiveSchool(schoolId: string | null | undefined): string {
  if (!schoolId) throw new NoActiveSchoolError();
  return schoolId;
}

/** `school_id` explícito para INSERT/UPSERT de entidade raiz. */
export function schoolScopedInsert<T extends Record<string, unknown>>(
  schoolId: string | null | undefined,
  values: T,
): T & { school_id: string } {
  return { ...values, school_id: assertActiveSchool(schoolId) };
}

/**
 * Aplica `.eq('school_id', ...)` quando há escola ativa.
 * Sem escola ativa a query é mantida (a RLS continua barrando o que não é do usuário).
 */
export function scopeToSchool<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  schoolId: string | null | undefined,
): Q {
  return schoolId ? query.eq('school_id', schoolId) : query;
}

/** Chave de cache/efeito que muda junto com a escola ativa. */
export function schoolScopeKey(schoolId: string | null | undefined): string {
  return schoolId ?? 'no-school';
}
