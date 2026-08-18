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
