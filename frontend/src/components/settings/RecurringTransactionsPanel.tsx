import clsx from 'clsx';
import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { categoriesApi } from '../../lib/api/categories';
import { recurringTransactionsApi } from '../../lib/api/recurringTransactions';
import type { Category, RecurringTransaction } from '../../lib/api/types';
import { eurosToCents, formatCents } from '../../lib/money';

type Sign = 'expense' | 'income';

const intervalLabels: Record<number, string> = {
  1: 'Monatlich',
  2: 'Alle 2 Monate',
  3: 'Vierteljährlich',
  6: 'Halbjährlich',
  12: 'Jährlich',
};

const intervalLabel = (months: number) => intervalLabels[months] ?? `Alle ${months} Monate`;

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const formatDate = (isoDate: string) => new Date(isoDate).toLocaleDateString('de-DE', { timeZone: 'UTC' });

export function RecurringTransactionsPanel() {
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sign, setSign] = useState<Sign>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [nextDueDate, setNextDueDate] = useState(todayIsoDate());
  const [intervalMonths, setIntervalMonths] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([recurringTransactionsApi.list(), categoriesApi.list()])
      .then(([r, c]) => {
        setItems(r);
        setCategories(c);
      })
      .catch(() => setError('Daten konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setSign('expense');
    setAmount('');
    setDescription('');
    setCategoryId('');
    setNextDueDate(todayIsoDate());
    setIntervalMonths('1');
    setFormError(null);
  };

  const startEdit = (item: RecurringTransaction) => {
    setEditingId(item.id);
    setSign(item.amount >= 0 ? 'income' : 'expense');
    setAmount(String(Math.abs(item.amount) / 100));
    setDescription(item.description);
    setCategoryId(item.categoryId);
    setNextDueDate(item.nextDueDate.slice(0, 10));
    setIntervalMonths(String(item.intervalMonths));
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const cents = eurosToCents(amount);
      const dto = {
        amount: sign === 'income' ? cents : -cents,
        description,
        categoryId,
        nextDueDate,
        intervalMonths: Number(intervalMonths),
      };
      if (editingId) {
        await recurringTransactionsApi.update(editingId, dto);
      } else {
        await recurringTransactionsApi.create(dto);
      }
      resetForm();
      load();
    } catch {
      setFormError('Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: RecurringTransaction) => {
    await recurringTransactionsApi.update(item.id, { active: !item.active });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Diese wiederkehrende Buchung wirklich löschen?')) return;
    await recurringTransactionsApi.remove(id);
    load();
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!items || !categories) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {editingId ? 'Fixkosten bearbeiten' : 'Fixkosten & wiederkehrende Buchungen'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Beschreibung</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z. B. Miete, Gehalt, Netflix"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
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
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Nächste Fälligkeit
            </label>
            <input
              type="date"
              required
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Rhythmus</label>
            <select
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {[1, 2, 3, 6, 12].map((months) => (
                <option key={months} value={months}>
                  {intervalLabel(months)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {editingId ? 'Speichern' : 'Anlegen'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Fälligkeit</th>
              <th className="px-4 py-2 font-medium">Rhythmus</th>
              <th className="px-4 py-2 font-medium">Beschreibung</th>
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Betrag</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={clsx(
                  'border-b border-neutral-100 last:border-0 dark:border-neutral-800',
                  !item.active && 'opacity-50',
                )}
              >
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{formatDate(item.nextDueDate)}</td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {intervalLabel(item.intervalMonths)}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{item.description}</td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {categoryById.get(item.categoryId)?.name ?? 'Unbekannt'}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{formatCents(item.amount)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label="Bearbeiten"
                    className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    aria-label={item.active ? 'Pausieren' : 'Fortsetzen'}
                    className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    {item.active ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Löschen"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  Noch keine wiederkehrenden Buchungen angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
