import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../lib/api/users';
import { financialPeriodLabel, getFinancialPeriod } from '../../lib/financialPeriod';

export function MonthCycleSettings() {
  const { user, refreshUser } = useAuth();
  const [monthStartDay, setMonthStartDay] = useState(String(user?.monthStartDay ?? 1));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const previewValue = Number(monthStartDay);
  const previewValid = Number.isInteger(previewValue) && previewValue >= 1 && previewValue <= 31;
  const previewLabel = previewValid ? financialPeriodLabel(getFinancialPeriod(previewValue)) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await usersApi.update({ monthStartDay: previewValue });
      await refreshUser();
      setSaved(true);
    } catch {
      setError('Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Abrechnungszeitraum</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Statt dem Kalendermonat kann dein "Finanzmonat" an einem anderen Tag starten — z. B. am
        Gehaltseingangstag. Dashboard, Budgets und die Fixkosten-Summe richten sich danach.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Starttag des Monats
          </label>
          <input
            type="number"
            min="1"
            max="31"
            required
            value={monthStartDay}
            onChange={(e) => {
              setMonthStartDay(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-24 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !previewValid}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Speichern
        </button>
      </form>

      {previewLabel && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Aktueller Zeitraum wäre: {previewLabel}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Gespeichert.</p>}
    </div>
  );
}
