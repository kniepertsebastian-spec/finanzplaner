import { registerSW } from 'virtual:pwa-register';
import { replayPendingTransactions } from './lib/syncTransactions';

registerSW({ immediate: true });

window.addEventListener('online', async () => {
  const registration = await navigator.serviceWorker.ready.catch(() => null);

  if (registration && 'sync' in registration) {
    try {
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(
        'sync-transactions',
      );
      return; // real Background Sync will handle it
    } catch {
      // fall through to a manual replay
    }
  }

  const count = await replayPendingTransactions();
  if (count > 0) {
    window.dispatchEvent(new CustomEvent('pending-transactions-changed'));
  }
});
