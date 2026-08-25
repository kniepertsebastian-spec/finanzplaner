import { startRegistration } from '@simplewebauthn/browser';
import { KeyRound, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authApi } from '../../lib/api/auth';
import { SkeletonList } from '../Skeleton';
import type { Authenticator } from '../../lib/api/types';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function authenticatorLabel(a: Authenticator): string {
  return a.deviceName?.trim() || `Passkey vom ${dateFormatter.format(new Date(a.createdAt))}`;
}

export function PasskeyManager() {
  const [authenticators, setAuthenticators] = useState<Authenticator[] | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    authApi
      .webauthnListAuthenticators()
      .then(setAuthenticators)
      .catch(() => setError('Passkeys konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const handleRegister = async () => {
    setError(null);
    setRegistering(true);
    try {
      const options = await authApi.webauthnRegisterOptions();
      const attestation = await startRegistration({ optionsJSON: options });
      await authApi.webauthnRegisterVerify({ ...attestation, deviceName: deviceName.trim() || undefined });
      setDeviceName('');
      load();
    } catch {
      // Covers both a browser/user cancellation (NotAllowedError) and a failed server-side
      // verification — either way there's nothing more specific a user could act on.
      setError('Passkey-Registrierung fehlgeschlagen oder abgebrochen.');
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Diesen Passkey wirklich entfernen?')) return;
    await authApi.webauthnDeleteAuthenticator(id);
    load();
  };

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Passkeys</h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Gerätename (optional)
          </label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="z. B. iPhone von Alex"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <button
          type="button"
          onClick={handleRegister}
          disabled={registering}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <KeyRound size={16} />
          Passkey hinzufügen
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {authenticators === null && <SkeletonList rows={2} />}
        {authenticators?.length === 0 && (
          <p className="py-2 text-sm text-neutral-400 dark:text-neutral-500">Noch keine Passkeys registriert.</p>
        )}
        {authenticators?.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">{authenticatorLabel(a)}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {a.lastUsedAt ? `Zuletzt genutzt am ${dateFormatter.format(new Date(a.lastUsedAt))}` : 'Noch nicht genutzt'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(a.id)}
              aria-label="Passkey entfernen"
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
