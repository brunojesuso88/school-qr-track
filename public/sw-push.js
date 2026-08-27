// EDUNEXUS — handlers de Web Push importados pelo service worker do PWA
// (registrado via workbox.importScripts em vite.config.ts).

const EDUNEXUS_DEFAULT_ROUTE = '/dashboard';

function edunexusSafeRoute(route) {
  if (typeof route !== 'string') return EDUNEXUS_DEFAULT_ROUTE;
  const value = route.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return EDUNEXUS_DEFAULT_ROUTE;
  return value;
}

function edunexusParsePayload(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json() || {};
    } catch (e) {
      try {
        data = { body: event.data.text() };
      } catch (e2) {
        data = {};
      }
    }
  }
  if (!data || typeof data !== 'object') data = {};

  const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

  return {
    title: str(data.title, 'EDUNEXUS'),
    body: str(data.body, 'Você tem uma nova notificação.'),
    icon: str(data.icon, '/pwa-192x192.png'),
    badge: str(data.badge, '/pwa-192x192.png'),
    tag: str(data.tag, 'edunexus-notification'),
    url: edunexusSafeRoute(data.url),
    notification_id: typeof data.notification_id === 'string' ? data.notification_id : null,
  };
}

self.addEventListener('push', function (event) {
  const payload = edunexusParsePayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      vibrate: [100, 50, 100],
      data: { url: payload.url, notification_id: payload.notification_id },
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = edunexusSafeRoute(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        try {
          const sameOrigin = new URL(client.url).origin === self.location.origin;
          if (sameOrigin) {
            if ('navigate' in client) {
              await client.navigate(target);
            }
            if ('focus' in client) {
              return client.focus();
            }
          }
        } catch (e) {
          // ignora clientes com URL inválida e tenta o próximo
        }
      }

      return self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', function (event) {
  // Reinscreve com a mesma applicationServerKey; o app sincroniza o novo
  // endpoint no próximo carregamento autenticado.
  const oldSubscription = event.oldSubscription;
  const applicationServerKey =
    oldSubscription && oldSubscription.options
      ? oldSubscription.options.applicationServerKey
      : undefined;

  if (!applicationServerKey) return;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey })
      .catch(function (err) {
        console.error('[SW] Falha ao reinscrever push:', err);
      }),
  );
});
