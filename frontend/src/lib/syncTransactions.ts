import { getPendingTransactions, removePendingTransaction } from './offlineDb';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Shared by both the service worker (real `sync` event) and the page (online-event
// fallback for browsers without Background Sync, e.g. Safari/iOS). Uses raw `fetch`
// instead of the axios apiClient, since axios's browser adapter needs
// XMLHttpRequest, which doesn't exist inside a Service Worker global scope.
export async function replayPendingTransactions(): Promise<number> {
  const pending = await getPendingTransactions();
  let syncedCount = 0;

  for (const item of pending) {
    if (item.localId === undefined) continue;
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item.input),
      });
      if (!res.ok) continue; // server rejected it — leave queued, try again next pass
      await removePendingTransaction(item.localId);
      syncedCount++;
    } catch {
      break; // still offline — stop this pass, remaining items stay queued
    }
  }

  return syncedCount;
}
