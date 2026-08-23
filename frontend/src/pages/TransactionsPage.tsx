import clsx from 'clsx';
import { Flag, Trash2, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { categoriesApi } from '../lib/api/categories';
import { transactionsApi } from '../lib/api/transactions';
import type { Category, Transaction } from '../lib/api/types';
import { formatCents } from '../lib/money';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([transactionsApi.list(), categoriesApi.list()])
      .then(([t, c]) => {
        setTransactions(t);
        setCategories(c);
      })
      .catch(() => setError('Transaktionen konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const handleToggleAvoidable = async (t: Transaction) => {
    await transactionsApi.update(t.id, { avoidable: !t.avoidable });
    load();
  };

  const handleToggleInefficient = async (t: Transaction) => {
    await transactionsApi.update(t.id, { inefficient: !t.inefficient });
    load();
  };

  const handleDelete = async (t: Transaction) => {
    if (!window.confirm(`Buchung "${t.description}" wirklich löschen?`)) return;
    await transactionsApi.remove(t.id);
    load();
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!transactions || !categories) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Transaktionen</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Markiere Buchungen als vermeidbar oder ineffizient (z. B. schlechte Bankgebühren).
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Beschreibung</th>
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Betrag</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {dateFormatter.format(new Date(t.date))}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{t.description}</td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {categoryById.get(t.categoryId)?.name ?? 'Unbekannt'}
                </td>
                <td
                  className={clsx(
                    'px-4 py-2 font-medium',
                    t.amount >= 0 ? 'text-[#2a78d6]' : 'text-[#eb6834]',
                  )}
                >
                  {formatCents(t.amount)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleAvoidable(t)}
                    aria-label={t.avoidable ? 'Als vermeidbar entfernen' : 'Als vermeidbar markieren'}
                    title="Vermeidbar"
                    className={clsx(
                      'mr-2 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      t.avoidable ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400',
                    )}
                  >
                    <Flag size={16} fill={t.avoidable ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleInefficient(t)}
                    aria-label={t.inefficient ? 'Als ineffizient entfernen' : 'Als ineffizient markieren'}
                    title="Ineffizient"
                    className={clsx(
                      'mr-2 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      t.inefficient ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400',
                    )}
                  >
                    <TrendingDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    aria-label="Löschen"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  Noch keine Transaktionen vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
