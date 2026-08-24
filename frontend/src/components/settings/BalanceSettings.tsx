import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../lib/api/users';
import { eurosToCents, formatCents } from '../../lib/money';

export function BalanceSettings() {
  const { user, refreshUser } = useAuth();
  const [calculatedBalance, setCalculatedBalance] = useState<number | null>(null);

  const [startingBalance, setStartingBalance] = useState(String((user?.startingBalance ?? 0) / 100));
  const [savingStart, setSavingStart] = useState(false);
  const [startSaved, setStartSaved] = useState(false);

  const [actualBalance, setActualBalance] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = async () => {
    try {
      const { balance } = await usersApi.getBalance();
      setCalculatedBalance(balance);
    } catch {
      setError('Saldo konnte nicht geladen werden.');
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const handleSaveStartingBalance = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStartSaved(false);
    setSavingStart(true);
    try {
      await usersApi.update({ startingBalance: eurosToCents(startingBalance) });
      await refreshUser();
      await loadBalance();
      setStartSaved(true);
    } catch {
      setError('Speichern fehlgeschlagen.');
    } finally {
      setSavingStart(false);
    }
  };

  const handleReconcile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setReconcileMessage(null);
    setReconciling(true);
    try {
      const result = await usersApi.reconcile(eurosToCents(actualBalance));
      setCalculatedBalance(result.actualBalance);
      if (result.diff === 0) {
        setReconcileMessage('Saldo stimmt bereits überein — keine Buchung nötig.');
      } else {
        const direction = result.diff > 0 ? 'Ausgleichsbuchung über +' : 'Ausgleichsbuchung über ';
        setReconcileMessage(`${direction}${formatCents(result.diff)} angelegt.`);
      }
      setActualBalance('');
    } catch {
      setError('Abgleich fehlgeschlagen.');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Kontostand</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Berechneter Saldo (Startsaldo + alle Buchungen):{' '}
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {calculatedBalance !== null ? formatCents(calculatedBalance) : '…'}
          </span>
        </p>
      </div>

      <form onSubmit={handleSaveStartingBalance} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Startsaldo (vor der ersten erfassten Buchung)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={startingBalance}
            onChange={(e) => {
              setStartingBalance(e.target.value);
              setStartSaved(false);
            }}
            className="mt-1 w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <button
          type="submit"
          disabled={savingStart}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Speichern
        </button>
        {startSaved && <p className="text-sm text-green-600 dark:text-green-400">Gespeichert.</p>}
      </form>

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Saldo abgleichen</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Trage den tatsächlichen Kontostand aus deinem Online-Banking ein — bei einer Abweichung wird automatisch
          eine Ausgleichsbuchung angelegt.
        </p>
        <form onSubmit={handleReconcile} className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Tatsächlicher Kontostand
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={actualBalance}
              onChange={(e) => {
                setActualBalance(e.target.value);
                setReconcileMessage(null);
              }}
              className="mt-1 w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <button
            type="submit"
            disabled={reconciling}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50 dark:bg-neutral-700 dark:hover:bg-neutral-600"
          >
            Abgleichen
          </button>
        </form>
        {reconcileMessage && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{reconcileMessage}</p>}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
