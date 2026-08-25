import { BellOff, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentSubscription,
  isPushSupported,
} from '../../lib/pushSubscribe';

export function NotificationSettings() {
  const [supported] = useState(isPushSupported());
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    getCurrentSubscription().then((sub) => setEnabled(sub !== null));
  }, [supported]);

  const handleToggle = async () => {
    setError(null);
    setBusy(true);
    try {
      if (enabled) {
        await disablePushNotifications();
        setEnabled(false);
      } else {
        await enablePushNotifications();
        setEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Benachrichtigungen</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Push-Benachrichtigungen bei Budgetüberschreitungen und anstehenden Großbuchungen (ab 200 €, fällig in
        den nächsten 3 Tagen) — einmal täglich geprüft.
      </p>

      {!supported && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">
          Dieser Browser unterstützt keine Push-Benachrichtigungen.
        </p>
      )}

      {supported && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          className="flex items-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {enabled ? <BellOff size={16} /> : <BellRing size={16} />}
          {enabled ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'}
        </button>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
