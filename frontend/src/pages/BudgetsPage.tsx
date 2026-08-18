import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { budgetsApi } from '../lib/api/budgets';
import { categoriesApi } from '../lib/api/categories';
import type { Budget, Category } from '../lib/api/types';
import { toMonthInputValue, toMonthISO } from '../lib/dateRange';
import { eurosToCents, formatCents } from '../lib/money';
import { listWithCache } from '../lib/offlineDb';

const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([listWithCache('budgets', () => budgetsApi.list()), listWithCache('categories', () => categoriesApi.list())])
      .then(([b, c]) => {
        setBudgets(b);
        setCategories(c);
      })
      .catch(() => setError('Daten konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setCategoryId('');
    setMonth('');
    setAmount('');
    setFormError(null);
  };

  const startEdit = (b: Budget) => {
    setEditingId(b.id);
    setCategoryId(b.categoryId);
    setMonth(toMonthInputValue(b.month));
    setAmount(String(b.amount / 100));
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const dto = { categoryId, month: toMonthISO(month), amount: eurosToCents(amount) };
      if (editingId) {
        await budgetsApi.update(editingId, dto);
      } else {
        await budgetsApi.create(dto);
      }
      resetForm();
      load();
    } catch {
      setFormError('Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Dieses Budget wirklich löschen?')) return;
    await budgetsApi.remove(id);
    load();
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!budgets || !categories) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {editingId ? 'Budget bearbeiten' : 'Neues Budget'}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Monat</label>
            <input
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Betrag (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
        </div>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Monat</th>
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Betrag</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {monthFormatter.format(new Date(b.month))}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {categoryById.get(b.categoryId)?.name ?? 'Unbekannt'}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{formatCents(b.amount)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(b)}
                    aria-label="Bearbeiten"
                    className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
                    aria-label="Löschen"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {budgets.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  Noch keine Budgets angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
