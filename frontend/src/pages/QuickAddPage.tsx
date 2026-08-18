import { isAxiosError } from 'axios';
import clsx from 'clsx';
import { useEffect, useState, type FormEvent } from 'react';
import { categoriesApi } from '../lib/api/categories';
import { transactionsApi, type TransactionInput } from '../lib/api/transactions';
import type { Category } from '../lib/api/types';
import { addPendingTransaction, listWithCache } from '../lib/offlineDb';
import { eurosToCents } from '../lib/money';

type Sign = 'expense' | 'income';
type Status = 'idle' | 'saved' | 'queued-offline';

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QuickAddPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sign, setSign] = useState<Sign>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listWithCache('categories', () => categoriesApi.list())
      .then(setCategories)
      .catch(() => setError('Kategorien konnten nicht geladen werden.'));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setStatus('idle');
    setSubmitting(true);

    const cents = eurosToCents(amount);
    const input: TransactionInput = {
      amount: sign === 'income' ? cents : -cents,
      description,
      date: new Date(date).toISOString(),
      categoryId,
    };

    try {
      await transactionsApi.create(input);
      setStatus('saved');
      setAmount('');
      setDescription('');
    } catch (err) {
      if (isAxiosError(err) && !err.response) {
        await addPendingTransaction(input);
        window.dispatchEvent(new CustomEvent('pending-transactions-changed'));
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready.catch(() => null);
          if (registration && 'sync' in registration) {
            await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
              .sync.register('sync-transactions')
              .catch(() => {});
          }
        }
        setStatus('queued-offline');
        setAmount('');
        setDescription('');
      } else {
        setFormError('Speichern fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!categories) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  return (
    <div className="mx-auto max-w-md">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Transaktion hinzufügen</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSign('expense')}
            className={clsx(
              'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
              sign === 'expense'
                ? 'border-transparent bg-[#eb6834] text-white'
                : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300',
            )}
          >
            Ausgabe
          </button>
          <button
            type="button"
            onClick={() => setSign('income')}
            className={clsx(
              'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
              sign === 'income'
                ? 'border-transparent bg-[#2a78d6] text-white'
                : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300',
            )}
          >
            Einnahme
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Betrag (€)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Beschreibung</label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Kategorie</label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="" disabled>
              Wählen…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Datum</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
        {status === 'saved' && <p className="text-sm text-green-600 dark:text-green-400">Transaktion gespeichert.</p>}
        {status === 'queued-offline' && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Offline gespeichert – wird synchronisiert, sobald wieder online.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Speichern
        </button>
      </form>
    </div>
  );
}
