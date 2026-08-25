/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { replayPendingTransactions } from './lib/syncTransactions';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Task 1: app-shell caching.
precacheAndRoute(self.__WB_MANIFEST);

// SPA fallback: react-router routes like `/add` or `/budgets` have no precache
// entry of their own — without this, a reload on a nested route falls through
// to the network and fails when offline. Every navigation gets the cached
// index.html shell instead; react-router then takes over client-side.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Web Push: budget-overrun / upcoming-large-transaction notifications sent by the backend's daily
// cron (see backend/src/push/push.service.ts). Payload is plain JSON `{ title, body }`.
self.addEventListener('push', (event) => {
  const pushEvent = event as unknown as { data?: { json: () => { title: string; body: string } }; waitUntil: (p: Promise<unknown>) => void };
  if (!pushEvent.data) return;
  const { title, body } = pushEvent.data.json();
  pushEvent.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/icon-192.png' }));
});

self.addEventListener('notificationclick', (event) => {
  const clickEvent = event as unknown as { notification: Notification; waitUntil: (p: Promise<unknown>) => void };
  clickEvent.notification.close();
  clickEvent.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return (existing as WindowClient).focus();
      return self.clients.openWindow('/');
    }),
  );
});

self.addEventListener('sync', (event) => {
  const syncEvent = event as unknown as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (syncEvent.tag !== 'sync-transactions') return;

  syncEvent.waitUntil(
    replayPendingTransactions().then((count) => {
      if (count > 0) {
        self.clients.matchAll().then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'pending-transactions-synced', count });
          }
        });
      }
    }),
  );
});
