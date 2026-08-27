import { DEFAULT_ROUTE, safeRoute } from './payload';

export interface ParsedPushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  url: string;
  notification_id: string | null;
}

/**
 * Parser tolerante do payload recebido no service worker.
 * Nunca lança: payload inválido cai em um aviso genérico com rota padrão.
 */
export function parsePushPayload(raw: unknown): ParsedPushPayload {
  let data: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
      else data = { body: raw };
    } catch {
      data = { body: raw };
    }
  } else if (raw && typeof raw === 'object') {
    data = raw as Record<string, unknown>;
  }

  const str = (v: unknown, fallback: string) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s.length ? s : fallback;
  };

  return {
    title: str(data.title, 'EDUNEXUS'),
    body: str(data.body, 'Você tem uma nova notificação.'),
    icon: str(data.icon, '/pwa-192x192.png'),
    badge: str(data.badge, '/pwa-192x192.png'),
    tag: str(data.tag, 'edunexus-notification'),
    url: safeRoute(typeof data.url === 'string' ? data.url : DEFAULT_ROUTE),
    notification_id: typeof data.notification_id === 'string' ? data.notification_id : null,
  };
}
