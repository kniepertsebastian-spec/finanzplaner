import { Pencil, PiggyBank, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { savingsPotsApi } from '../../lib/api/savingsPots';
import type { SavingsPot } from '../../lib/api/types';
import { eurosToCents, formatCents } from '../../lib/money';

export function SavingsPotsPanel() {
  const [pots, setPots] = useState<SavingsPot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    savingsPotsApi
      .list()
      .then(setPots)
      .catch(() => setError('Töpfe konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setTarget('');
    setFormError(null);
  };

  const startEdit = (pot: SavingsPot) => {
    setEditingId(pot.id);
    setName(pot.name);
    setAmount(String(pot.amountCents / 100));
    setTarget(pot.targetCents != null ? String(pot.targetCents / 100) : '');
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const dto = {
        name,
        amountCents: amount === '' ? 0 : eurosToCents(amount),
        targetCents: target === '' ? undefined : eurosToCents(target),
      };
      if (editingId) {
        await savingsPotsApi.update(editingId, dto);
      } else {
        await savingsPotsApi.create(dto);
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
    if (!window.confirm('Diesen Topf wirklich löschen? Das zurückgelegte Geld gilt danach wieder als frei verfügbar.'))
      return;
    await savingsPotsApi.remove(id);
    load();
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!pots) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  const totalLockedCents = pots.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {editingId ? 'Topf bearbeiten' : 'Virtuelle Töpfe (Rücklagen)'}
        </h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Geld, das du für einen Zweck zurücklegst (z. B. Notgroschen, Kfz-Steuer, Urlaub). Der zurückgelegte Betrag
          wird vom "Frei verfügbar" auf dem Dashboard abgezogen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Notgroschen"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Zurückgelegt (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Sparziel (€, optional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Kein Ziel"
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
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Zurückgelegt</th>
              <th className="px-4 py-2 font-medium">Ziel</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {pots.map((pot) => (
              <tr key={pot.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <PiggyBank size={14} className="text-neutral-400 dark:text-neutral-500" />
                    {pot.name}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{formatCents(pot.amountCents)}</td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {pot.targetCents != null ? formatCents(pot.targetCents) : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(pot)}
                    aria-label="Bearbeiten"
                    className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pot.id)}
                    aria-label="Löschen"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {pots.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  Noch keine Töpfe angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pots.length > 0 && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Insgesamt gesperrt: <span className="font-medium">{formatCents(totalLockedCents)}</span>
        </p>
      )}
    </div>
  );
}
