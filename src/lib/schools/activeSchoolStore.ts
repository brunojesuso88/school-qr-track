/**
 * Store mínimo e observável da ESCOLA ATIVA.
 *
 * Existe para que `AuthContext` (papel efetivo) e `SchoolContext` (seleção)
 * compartilhem o mesmo valor sem criar dependência circular entre contexts.
 * A fonte da verdade continua sendo os memberships ativos do usuário.
 */

const STORAGE_KEY = 'edunexus.activeSchoolId';

type Listener = () => void;

let current: string | null = readStored();
const listeners = new Set<Listener>();

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getActiveSchoolIdSnapshot(): string | null {
  return current;
}

/** Define a escola ativa. `persist=false` para seleções derivadas/efêmeras. */
export function setActiveSchoolIdStore(schoolId: string | null, persist = true): void {
  if (current === schoolId) return;
  current = schoolId;
  if (persist) {
    try {
      if (schoolId) localStorage.setItem(STORAGE_KEY, schoolId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage indisponível (modo privado): mantém apenas em memória */
    }
  }
  listeners.forEach((l) => l());
}

export function subscribeActiveSchoolId(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const ACTIVE_SCHOOL_STORAGE_KEY = STORAGE_KEY;
