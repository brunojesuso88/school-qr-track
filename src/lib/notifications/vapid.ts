/**
 * Utilitários da chave VAPID pública usada no navegador.
 * A chave PRIVADA nunca chega ao frontend — somente o servidor a conhece.
 */

/** Base64url de uma chave pública P-256 descomprimida tem ~87 chars e começa com "B". */
export function isValidVapidPublicKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 80 || trimmed.length > 100) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;
  if (!trimmed.startsWith('B')) return false;
  // Uma chave P-256 descomprimida tem 65 bytes (0x04 + X + Y).
  try {
    return urlBase64ToUint8Array(trimmed).length === 65;
  } catch {
    return false;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

export function uint8ArrayToUrlBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Uma subscription só é reutilizável se foi criada com a MESMA chave pública.
 * Quando o par VAPID é rotacionado, a subscription antiga precisa ser recriada.
 */
export function subscriptionMatchesKey(
  applicationServerKey: ArrayBuffer | null | undefined,
  publicKey: string,
): boolean {
  if (!applicationServerKey) return false;
  try {
    return uint8ArrayToUrlBase64(new Uint8Array(applicationServerKey)) === publicKey.trim();
  } catch {
    return false;
  }
}
