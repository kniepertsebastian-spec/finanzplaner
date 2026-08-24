import clsx from 'clsx';
import { ArrowUpCircle, Flag, Pause, Pencil, Play, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { categoriesApi } from '../../lib/api/categories';
import { recurringTransactionsApi } from '../../lib/api/recurringTransactions';
import type { Category, RecurringTransaction } from '../../lib/api/types';
import { priceIncreaseRules } from '../../lib/budgetCalc';
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
  const [contractNumber, setContractNumber] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [cancellationPeriodDays, setCancellationPeriodDays] = useState('');
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
    setContractNumber('');
    setContractEndDate('');
    setCancellationPeriodDays('');
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
    setContractNumber(item.contractNumber ?? '');
    setContractEndDate(item.contractEndDate ? item.contractEndDate.slice(0, 10) : '');
    setCancellationPeriodDays(item.cancellationPeriodDays != null ? String(item.cancellationPeriodDays) : '');
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
        contractNumber: contractNumber || undefined,
        contractEndDate: contractEndDate || undefined,
        cancellationPeriodDays: cancellationPeriodDays ? Number(cancellationPeriodDays) : undefined,
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

  const handleToggleAvoidable = async (item: RecurringTransaction) => {
    await recurringTransactionsApi.update(item.id, { avoidable: !item.avoidable });
    load();
  };

  const handleToggleInefficient = async (item: RecurringTransaction) => {
    await recurringTransactionsApi.update(item.id, { inefficient: !item.inefficient });
    load();
  };

  const handleToggleTooExpensive = async (item: RecurringTransaction) => {
    await recurringTransactionsApi.update(item.id, { tooExpensive: !item.tooExpensive });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Diese wiederkehrende Buchung wirklich löschen?')) return;
    await recurringTransactionsApi.remove(id);
    load();
  };

  const handleDismissPriceIncrease = async (id: string) => {
    await recurringTransactionsApi.dismissPriceIncrease(id);
    load();
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!items || !categories) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const priceIncreaseByRuleId = new Map(priceIncreaseRules(items).map((p) => [p.recurring.id, p.previousAmount]));

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

        <div className="space-y-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Vertragsdaten (optional, z. B. für Internet/Versicherungen mit Mindestlaufzeit)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Vertragsnummer
              </label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Mindestlaufzeit-Ende
              </label>
              <input
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Kündigungsfrist (Tage vorher)
              </label>
              <input
                type="number"
                min="1"
                value={cancellationPeriodDays}
                onChange={(e) => setCancellationPeriodDays(e.target.value)}
                placeholder="z. B. 30"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
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
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {formatCents(item.amount)}
                  {priceIncreaseByRuleId.has(item.id) && (
                    <span
                      title={`Preiserhöhung: ${formatCents(priceIncreaseByRuleId.get(item.id)!)} → ${formatCents(item.amount)}`}
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                    >
                      <ArrowUpCircle size={12} />
                      erhöht
                      <button
                        type="button"
                        onClick={() => handleDismissPriceIncrease(item.id)}
                        aria-label="Preiserhöhungs-Hinweis bestätigen"
                        title="Bestätigen"
                        className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-200"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleAvoidable(item)}
                    aria-label={item.avoidable ? 'Als vermeidbar entfernen' : 'Als vermeidbar markieren'}
                    title="Vermeidbar"
                    className={clsx(
                      'mr-2 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      item.avoidable
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-500 dark:text-neutral-400',
                    )}
                  >
                    <Flag size={16} fill={item.avoidable ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleInefficient(item)}
                    aria-label={item.inefficient ? 'Als ineffizient entfernen' : 'Als ineffizient markieren'}
                    title="Ineffizient"
                    className={clsx(
                      'mr-2 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      item.inefficient
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-neutral-500 dark:text-neutral-400',
                    )}
                  >
                    <TrendingDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTooExpensive(item)}
                    aria-label={item.tooExpensive ? 'Als zu hoch entfernen' : 'Als zu hoch markieren'}
                    title="Zu hoch"
                    className={clsx(
                      'mr-2 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      item.tooExpensive
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-neutral-500 dark:text-neutral-400',
                    )}
                  >
                    <TrendingUp size={16} />
                  </button>
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
