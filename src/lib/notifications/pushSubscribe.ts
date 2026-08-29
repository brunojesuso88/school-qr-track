import { subscriptionMatchesKey, urlBase64ToUint8Array } from './vapid';

export interface MinimalPushSubscription {
  endpoint: string;
  options?: { applicationServerKey?: ArrayBuffer | null };
  unsubscribe: () => Promise<boolean>;
  getKey: (name: 'p256dh' | 'auth') => ArrayBuffer | null;
}

export interface MinimalPushManager {
  getSubscription: () => Promise<MinimalPushSubscription | null>;
  subscribe: (options: {
    userVisibleOnly: boolean;
    applicationServerKey: ArrayBuffer;
  }) => Promise<MinimalPushSubscription>;
}

export interface EnsureSubscriptionResult {
  subscription: MinimalPushSubscription;
  rotated: boolean;
}

/**
 * Reutiliza a subscription atual quando ela foi criada com a MESMA chave VAPID.
 * Se o par VAPID foi rotacionado (ou a chave é desconhecida), remove a antiga
 * (unsubscribe + limpeza do registro no banco) e cria uma nova.
 */
export async function ensurePushSubscription(
  pushManager: MinimalPushManager,
  publicKey: string,
  onStaleEndpoint?: (endpoint: string) => Promise<void> | void,
): Promise<EnsureSubscriptionResult> {
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const existing = await pushManager.getSubscription();

  if (existing) {
    if (subscriptionMatchesKey(existing.options?.applicationServerKey, publicKey)) {
      return { subscription: existing, rotated: false };
    }
    const staleEndpoint = existing.endpoint;
    try {
      await existing.unsubscribe();
    } catch {
      /* endpoint já inválido no navegador — segue para recriar */
    }
    if (onStaleEndpoint) await onStaleEndpoint(staleEndpoint);
  }

  const subscription = await pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
  });
  return { subscription, rotated: !!existing };
}
