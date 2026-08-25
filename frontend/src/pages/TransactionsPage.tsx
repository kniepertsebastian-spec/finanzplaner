import clsx from 'clsx';
import { Flag, Pencil, Plus, SplitSquareHorizontal, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Amount } from '../components/Amount';
import { CategoryBadge } from '../components/CategoryBadge';
import { Skeleton } from '../components/Skeleton';
import { TagBadge } from '../components/TagBadge';
import { categoriesApi } from '../lib/api/categories';
import { transactionsApi } from '../lib/api/transactions';
import type { Category, Transaction } from '../lib/api/types';
import { eurosToCents, formatCents } from '../lib/money';
import { parseTags } from '../lib/parseTags';

type Sign = 'expense' | 'income';

interface SplitRow {
  amount: string;
  categoryId: string;
}

const emptySplitRow = (): SplitRow => ({ amount: '', categoryId: '' });

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const groupDateFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// "Heute"/"Gestern" for the two most recent calendar days, a full formatted date otherwise —
// compared via local calendar day (same convention the existing date column already uses via
// `new Date(t.date)`), not raw ISO string slicing.
function dateGroupLabel(dateISO: string): string {
  const d = new Date(dateISO);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Heute';
  if (dayKey(d) === dayKey(yesterday)) return 'Gestern';
  return groupDateFormatter.format(d);
}

// Transactions arrive sorted by date desc from the backend, so same-label transactions are always
// contiguous — a single linear pass is enough to group them into date blocks.
function groupByDate(transactions: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups: { label: string; items: Transaction[] }[] = [];
  for (const t of transactions) {
    const label = dateGroupLabel(t.date);
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.items.push(t);
    } else {
      groups.push({ label, items: [t] });
    }
  }
  return groups;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sign, setSign] = useState<Sign>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [splitting, setSplitting] = useState(false);
  const [splitSign, setSplitSign] = useState<Sign>('expense');
  const [splitDescription, setSplitDescription] = useState('');
  const [splitDate, setSplitDate] = useState('');
  const [splitRows, setSplitRows] = useState<SplitRow[]>([emptySplitRow(), emptySplitRow()]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitSubmitting, setSplitSubmitting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');

  const load = () => {
    Promise.all([transactionsApi.list(), categoriesApi.list()])
      .then(([t, c]) => {
        setTransactions(t);
        setCategories(c);
        // Drop any selected id that no longer exists (e.g. deleted via the single-row action)
        // instead of leaving a stale, invisible entry in the selection count.
        const stillPresent = new Set(t.map((tx) => tx.id));
        setSelectedIds((prev) => new Set([...prev].filter((id) => stillPresent.has(id))));
      })
      .catch(() => setError('Transaktionen konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setSign('expense');
    setAmount('');
    setDescription('');
    setCategoryId('');
    setDate('');
    setTagsInput('');
    setFormError(null);
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setSign(t.amount >= 0 ? 'income' : 'expense');
    setAmount(String(Math.abs(t.amount) / 100));
    setDescription(t.description);
    setCategoryId(t.categoryId);
    setDate(t.date.slice(0, 10));
    setTagsInput(t.tags.join(' '));
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const cents = Math.abs(eurosToCents(amount));
      await transactionsApi.update(editingId, {
        amount: sign === 'income' ? cents : -cents,
        description,
        categoryId,
        date,
        tags: parseTags(tagsInput),
      });
      resetForm();
      load();
    } catch {
      setFormError('Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvoidable = async (t: Transaction) => {
    await transactionsApi.update(t.id, { avoidable: !t.avoidable });
    load();
  };

  const handleToggleInefficient = async (t: Transaction) => {
    await transactionsApi.update(t.id, { inefficient: !t.inefficient });
    load();
  };

  const handleToggleTooExpensive = async (t: Transaction) => {
    await transactionsApi.update(t.id, { tooExpensive: !t.tooExpensive });
    load();
  };

  const handleDelete = async (t: Transaction) => {
    if (!window.confirm(`Buchung "${t.description}" wirklich löschen?`)) return;
    await transactionsApi.remove(t.id);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleTransactions = (transactions ?? []).filter((t) => !tagFilter || t.tags.includes(tagFilter));

  const allSelected = visibleTransactions.length > 0 && visibleTransactions.every((t) => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const t of visibleTransactions) next.delete(t.id);
        return next;
      }
      return new Set([...prev, ...visibleTransactions.map((t) => t.id)]);
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (!window.confirm(`${selectedIds.size} Buchung(en) wirklich löschen?`)) return;
    setBulkBusy(true);
    try {
      await transactionsApi.bulkRemove([...selectedIds]);
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkCategoryChange = async (newCategoryId: string) => {
    if (!newCategoryId) return;
    setBulkBusy(true);
    try {
      await transactionsApi.bulkUpdate([...selectedIds], { categoryId: newCategoryId });
      clearSelection();
      setBulkCategoryId('');
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkFlag = async (flag: 'avoidable' | 'inefficient' | 'tooExpensive') => {
    setBulkBusy(true);
    try {
      await transactionsApi.bulkUpdate([...selectedIds], { [flag]: true });
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const resetSplitForm = () => {
    setSplitting(false);
    setSplitSign('expense');
    setSplitDescription('');
    setSplitDate('');
    setSplitRows([emptySplitRow(), emptySplitRow()]);
    setSplitError(null);
  };

  const updateSplitRow = (index: number, patch: Partial<SplitRow>) => {
    setSplitRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addSplitRow = () => setSplitRows((rows) => [...rows, emptySplitRow()]);

  const removeSplitRow = (index: number) => setSplitRows((rows) => rows.filter((_, i) => i !== index));

  const splitTotalCents = splitRows.reduce((sum, row) => sum + (row.amount ? Math.abs(eurosToCents(row.amount)) : 0), 0);

  const handleSplitSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSplitError(null);
    if (splitRows.some((row) => !row.amount || !row.categoryId)) {
      setSplitError('Bitte für jede Zeile Betrag und Kategorie angeben.');
      return;
    }
    setSplitSubmitting(true);
    try {
      await transactionsApi.createSplit({
        description: splitDescription,
        date: splitDate || undefined,
        splits: splitRows.map((row) => {
          const rowCents = Math.abs(eurosToCents(row.amount));
          return {
            amount: splitSign === 'income' ? rowCents : -rowCents,
            categoryId: row.categoryId,
          };
        }),
      });
      resetSplitForm();
      load();
    } catch {
      setSplitError('Aufteilen fehlgeschlagen.');
    } finally {
      setSplitSubmitting(false);
    }
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!transactions || !categories) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const splitSiblingsByGroupId = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.splitGroupId) continue;
    const siblings = splitSiblingsByGroupId.get(t.splitGroupId) ?? [];
    siblings.push(t);
    splitSiblingsByGroupId.set(t.splitGroupId, siblings);
  }

  const allTags = [...new Set(transactions.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b, 'de'));
  const tagFilterSumCents = visibleTransactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Transaktionen</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Markiere Buchungen als vermeidbar, ineffizient (z. B. schlechte Bankgebühren) oder zu hoch.
          </p>
        </div>
        {!splitting && (
          <button
            type="button"
            onClick={() => setSplitting(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <SplitSquareHorizontal size={16} />
            Buchung aufteilen
          </button>
        )}
      </div>

      {splitting && (
        <form
          onSubmit={handleSplitSubmit}
          className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Buchung auf mehrere Kategorien aufteilen
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSplitSign('expense')}
              className={clsx(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
                splitSign === 'expense'
                  ? 'border-transparent bg-[#eb6834] text-white'
                  : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300',
              )}
            >
              Ausgabe
            </button>
            <button
              type="button"
              onClick={() => setSplitSign('income')}
              className={clsx(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
                splitSign === 'income'
                  ? 'border-transparent bg-[#2a78d6] text-white'
                  : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300',
              )}
            >
              Einnahme
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Beschreibung
              </label>
              <input
                type="text"
                required
                value={splitDescription}
                onChange={(e) => setSplitDescription(e.target.value)}
                placeholder="z. B. Supermarkt-Einkauf"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Datum (optional, sonst heute)
              </label>
              <input
                type="date"
                value={splitDate}
                onChange={(e) => setSplitDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            {splitRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={row.amount}
                  onChange={(e) => updateSplitRow(index, { amount: e.target.value })}
                  placeholder="Betrag (€)"
                  className="w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <select
                  required
                  value={row.categoryId}
                  onChange={(e) => updateSplitRow(index, { categoryId: e.target.value })}
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  <option value="" disabled>
                    Kategorie wählen…
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {splitRows.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeSplitRow(index)}
                    aria-label="Zeile entfernen"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addSplitRow}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <Plus size={14} /> Weitere Kategorie
            </button>
          </div>

          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Summe:{' '}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              <Amount cents={splitSign === 'income' ? splitTotalCents : -splitTotalCents} />
            </span>
          </p>

          {splitError && <p className="text-sm text-red-600 dark:text-red-400">{splitError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={splitSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Aufteilen
            </button>
            <button
              type="button"
              onClick={resetSplitForm}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {editingId && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Buchung bearbeiten</h2>
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
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Beschreibung
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Datum</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Tags (optional, mit Leerzeichen getrennt)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="z. B. Urlaub2026 Renovierung"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Tags:</span>
          {allTags.map((tag) => (
            <TagBadge key={tag} tag={tag} active={tagFilter === tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} />
          ))}
          {tagFilter && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Summe für #{tagFilter}:{' '}
              <span className={clsx('font-medium', tagFilterSumCents >= 0 ? 'text-[#2a78d6]' : 'text-[#eb6834]')}>
                <Amount cents={tagFilterSumCents} />
              </span>
            </span>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm dark:border-blue-900 dark:bg-blue-950/40">
          <span className="font-medium text-blue-900 dark:text-blue-200">{selectedIds.size} ausgewählt</span>
          <select
            value={bulkCategoryId}
            disabled={bulkBusy}
            onChange={(e) => {
              setBulkCategoryId(e.target.value);
              handleBulkCategoryChange(e.target.value);
            }}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Kategorie ändern…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => handleBulkFlag('avoidable')}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Als vermeidbar markieren
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => handleBulkFlag('inefficient')}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Als ineffizient markieren
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => handleBulkFlag('tooExpensive')}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Als zu hoch markieren
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={handleBulkDelete}
            className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} /> Löschen
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto flex items-center gap-1 text-xs text-blue-900 hover:underline dark:text-blue-200"
          >
            <X size={14} /> Auswahl aufheben
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Alle auswählen"
                  className="rounded border-neutral-300 dark:border-neutral-700"
                />
              </th>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Beschreibung</th>
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Betrag</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {groupByDate(visibleTransactions).map((group) => (
              <Fragment key={group.items[0].id}>
                <tr>
                  <td
                    colSpan={6}
                    className="bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.items.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                    aria-label={`"${t.description}" auswählen`}
                    className="rounded border-neutral-300 dark:border-neutral-700"
                  />
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {dateFormatter.format(new Date(t.date))}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {t.description}
                  {t.splitGroupId && (
                    <span
                      title={`Teil einer Aufteilung: ${(splitSiblingsByGroupId.get(t.splitGroupId) ?? [])
                        .map((s) => `${categoryById.get(s.categoryId)?.name ?? 'Unbekannt'} ${formatCents(s.amount)}`)
                        .join(', ')}`}
                      className="ml-1.5 inline-flex items-center text-neutral-400 dark:text-neutral-500"
                    >
                      <SplitSquareHorizontal size={12} />
                    </span>
                  )}
                  {t.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.tags.map((tag) => (
                        <TagBadge key={tag} tag={tag} active={tagFilter === tag} onClick={() => setTagFilter(tag)} />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  {categoryById.get(t.categoryId) ? (
                    <CategoryBadge categoryId={t.categoryId} name={categoryById.get(t.categoryId)!.name} />
                  ) : (
                    <span className="text-neutral-700 dark:text-neutral-300">Unbekannt</span>
                  )}
                </td>
                <td
                  className={clsx(
                    'px-4 py-2 font-medium',
                    t.amount >= 0 ? 'text-[#2a78d6]' : 'text-[#eb6834]',
                  )}
                >
                  <Amount cents={t.amount} />
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
                    onClick={() => handleToggleTooExpensive(t)}
                    aria-label={t.tooExpensive ? 'Als zu hoch entfernen' : 'Als zu hoch markieren'}
                    title="Zu hoch"
                    className={clsx(
                      'mr-2 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      t.tooExpensive ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-500 dark:text-neutral-400',
                    )}
                  >
                    <TrendingUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    aria-label="Bearbeiten"
                    className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Pencil size={16} />
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
              </Fragment>
            ))}
            {visibleTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  {tagFilter ? `Keine Buchungen mit Tag #${tagFilter}.` : 'Noch keine Transaktionen vorhanden.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
