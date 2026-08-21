import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api/auth';

export function TotpEnrollment() {
  const { user, refreshUser } = useAuth();
  const [pending, setPending] = useState<{ qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totpEnabled = user?.totpEnabled ?? false;

  const startEnroll = async () => {
    setError(null);
    try {
      const { qrCodeDataUrl } = await authApi.totpEnroll();
      setPending({ qrCodeDataUrl });
    } catch {
      setError('QR-Code konnte nicht erzeugt werden.');
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.totpVerifyEnable(code);
      setPending(null);
      setCode('');
      await refreshUser();
    } catch {
      setError('Code ungültig oder abgelaufen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.totpDisable(code);
      setCode('');
      await refreshUser();
    } catch {
      setError('Code ungültig oder abgelaufen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Authenticator-App (TOTP)</h2>

      {totpEnabled ? (
        <form onSubmit={handleDisable} className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            TOTP ist aktiviert. Gib einen aktuellen Code aus deiner Authenticator-App ein, um es zu deaktivieren.
          </p>
          <div className="flex items-end gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Deaktivieren
            </button>
          </div>
        </form>
      ) : pending ? (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            QR-Code mit deiner Authenticator-App scannen und den generierten Code eingeben.
          </p>
          <img src={pending.qrCodeDataUrl} alt="TOTP QR-Code" className="h-40 w-40 rounded-md border border-neutral-200 dark:border-neutral-800" />
          <div className="flex items-end gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Bestätigen
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setCode('');
                setError(null);
              }}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            TOTP ist derzeit deaktiviert. Login funktioniert dann nur mit Passwort bzw. Passkey.
          </p>
          <button
            type="button"
            onClick={startEnroll}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            TOTP aktivieren
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
