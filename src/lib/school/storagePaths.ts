/**
 * Caminhos de storage escopados por escola.
 *
 * Novos arquivos são gravados em `schools/<school_id>/<caminho original>`.
 * Arquivos legados (sem o prefixo) continuam funcionando: as policies de storage
 * só exigem vínculo com a escola quando o caminho é escopado.
 */

export const SCHOOL_STORAGE_PREFIX = 'schools';

/** Prefixa `path` com a pasta da escola ativa. Sem escola ativa, mantém o caminho legado. */
export function schoolScopedPath(schoolId: string | null | undefined, path: string): string {
  const clean = path.replace(/^\/+/, '');
  if (!schoolId) return clean;
  if (clean.startsWith(`${SCHOOL_STORAGE_PREFIX}/${schoolId}/`)) return clean;
  return `${SCHOOL_STORAGE_PREFIX}/${schoolId}/${clean}`;
}

/** Extrai o school_id de um caminho escopado; `null` para caminhos legados. */
export function schoolIdFromStoragePath(path: string | null | undefined): string | null {
  if (!path) return null;
  const parts = path.split('/');
  if (parts.length < 3 || parts[0] !== SCHOOL_STORAGE_PREFIX) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid.test(parts[1]) ? parts[1] : null;
}
