/**
 * Token de cadastro escolar pendente.
 *
 * O token do link `/join/:token` precisa sobreviver a fluxos que saem da página:
 * confirmação de e-mail e login em `/auth`. Guardamos apenas o token (dado já
 * público, presente na URL do link) e nunca credenciais.
 */

export const PENDING_JOIN_TOKEN_KEY = 'edunexus.pendingJoinToken';

const safeStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const VALID = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidJoinTokenShape(token: string | null | undefined): boolean {
  return typeof token === 'string' && VALID.test(token);
}

export function setPendingJoinToken(token: string): void {
  if (!isValidJoinTokenShape(token)) return;
  safeStorage()?.setItem(PENDING_JOIN_TOKEN_KEY, token);
}

export function getPendingJoinToken(): string | null {
  const value = safeStorage()?.getItem(PENDING_JOIN_TOKEN_KEY) ?? null;
  return isValidJoinTokenShape(value) ? value : null;
}

export function clearPendingJoinToken(): void {
  safeStorage()?.removeItem(PENDING_JOIN_TOKEN_KEY);
}
