// Custom Service Worker for Push Notifications
// This file handles push events and notification clicks

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  if (!event.data) {
    console.log('[SW] No data in push event');
    return;
  }
  
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    data = {
      title: 'EDUNEXUS',
      body: event.data.text()
    };
  }
  
  const options = {
    body: data.body || 'Nova notificação',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    data: data.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: true,
    tag: data.tag || 'edunexus-notification',
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'EDUNEXUS', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/home';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        return clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event);
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[SW] Push subscription changed');
  // The subscription has changed, re-subscribe
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then(subscription => {
        console.log('[SW] Resubscribed:', subscription);
        // You could send this to your server here
      })
      .catch(err => {
        console.error('[SW] Failed to resubscribe:', err);
      })
  );
});
