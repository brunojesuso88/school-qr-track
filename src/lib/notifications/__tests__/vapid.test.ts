import { describe, it, expect, vi } from 'vitest';
import {
  isValidVapidPublicKey,
  urlBase64ToUint8Array,
  uint8ArrayToUrlBase64,
  subscriptionMatchesKey,
} from '../vapid';
import { ensurePushSubscription, type MinimalPushSubscription } from '../pushSubscribe';

/** Chave pública P-256 válida (65 bytes, base64url) — apenas para teste. */
function makePublicKey(seed = 7): string {
  const bytes = new Uint8Array(65);
  bytes[0] = 4;
  for (let i = 1; i < 65; i += 1) bytes[i] = (i * seed) % 256;
  return uint8ArrayToUrlBase64(bytes);
}

const VALID_KEY = makePublicKey();
const OTHER_KEY = makePublicKey(11);

describe('chave VAPID pública', () => {
  it('aceita chave base64url de 65 bytes iniciando com B', () => {
    expect(VALID_KEY.startsWith('B')).toBe(true);
    expect(VALID_KEY.length).toBeGreaterThanOrEqual(80);
    expect(isValidVapidPublicKey(VALID_KEY)).toBe(true);
  });

  it('rejeita placeholder curto, formato inválido e valores não string', () => {
    expect(isValidVapidPublicKey('BEl62iUYg')).toBe(false);
    expect(isValidVapidPublicKey(`${VALID_KEY.slice(0, -1)}+`)).toBe(false);
    expect(isValidVapidPublicKey(undefined)).toBe(false);
    expect(isValidVapidPublicKey('')).toBe(false);
  });

  it('converte base64url para Uint8Array de 65 bytes (ida e volta)', () => {
    const bytes = urlBase64ToUint8Array(VALID_KEY);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    expect(uint8ArrayToUrlBase64(bytes)).toBe(VALID_KEY);
  });

  it('não depende de nenhuma variável de build VITE_VAPID_PUBLIC_KEY', async () => {
    const { readFileSync } = await import('node:fs');
    const hook = readFileSync('src/hooks/usePushNotifications.ts', 'utf8');
    expect(hook).not.toContain('VITE_VAPID');
    expect(readFileSync('src/lib/notifications/vapid.ts', 'utf8')).not.toContain('VITE_VAPID');
    expect(hook).toContain("supabase.functions.invoke('push-public-key')");
  });


  it('compara applicationServerKey da subscription com a chave atual', () => {
    const buf = urlBase64ToUint8Array(VALID_KEY).buffer as ArrayBuffer;
    expect(subscriptionMatchesKey(buf, VALID_KEY)).toBe(true);
    expect(subscriptionMatchesKey(buf, OTHER_KEY)).toBe(false);
    expect(subscriptionMatchesKey(null, VALID_KEY)).toBe(false);
  });
});

function fakeSubscription(endpoint: string, key: string | null): MinimalPushSubscription {
  return {
    endpoint,
    options: { applicationServerKey: key ? (urlBase64ToUint8Array(key).buffer as ArrayBuffer) : null },
    unsubscribe: vi.fn().mockResolvedValue(true),
    getKey: () => new ArrayBuffer(8),
  };
}

describe('rotação de subscriptions', () => {
  it('reutiliza subscription criada com a mesma chave', async () => {
    const existing = fakeSubscription('https://push/old', VALID_KEY);
    const subscribe = vi.fn();
    const onStale = vi.fn();
    const result = await ensurePushSubscription(
      { getSubscription: async () => existing, subscribe },
      VALID_KEY,
      onStale,
    );
    expect(result.rotated).toBe(false);
    expect(result.subscription.endpoint).toBe('https://push/old');
    expect(subscribe).not.toHaveBeenCalled();
    expect(onStale).not.toHaveBeenCalled();
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it('recria subscription quando o par VAPID foi rotacionado e limpa o endpoint antigo', async () => {
    const existing = fakeSubscription('https://push/old', OTHER_KEY);
    const created = fakeSubscription('https://push/new', VALID_KEY);
    const subscribe = vi.fn().mockResolvedValue(created);
    const onStale = vi.fn();
    const result = await ensurePushSubscription(
      { getSubscription: async () => existing, subscribe },
      VALID_KEY,
      onStale,
    );
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(onStale).toHaveBeenCalledWith('https://push/old');
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(result.rotated).toBe(true);
    expect(result.subscription.endpoint).toBe('https://push/new');
  });

  it('cria subscription quando não existe nenhuma', async () => {
    const created = fakeSubscription('https://push/new', VALID_KEY);
    const result = await ensurePushSubscription(
      { getSubscription: async () => null, subscribe: vi.fn().mockResolvedValue(created) },
      VALID_KEY,
    );
    expect(result.rotated).toBe(false);
    expect(result.subscription.endpoint).toBe('https://push/new');
  });
});
