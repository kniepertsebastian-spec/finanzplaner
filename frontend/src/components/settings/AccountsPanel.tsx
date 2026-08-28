import { Archive, ArchiveRestore, Landmark, Pencil, PiggyBank, Trash2, Wallet } from 'lucide-react';
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { accountsApi } from '../../lib/api/accounts';
import type { AccountType, AccountWithBalance } from '../../lib/api/types';
import { eurosToCents, formatCents } from '../../lib/money';
import { Amount } from '../Amount';
import { SkeletonList } from '../Skeleton';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Girokonto',
  SAVINGS: 'Sparkonto',
  CASH: 'Bargeld',
  OTHER: 'Sonstiges',
};

const ACCOUNT_TYPE_ICONS: Record<AccountType, typeof Landmark> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CASH: Wallet,
  OTHER: Landmark,
};

export function AccountsPanel() {
  const [accounts, setAccounts] = useState<AccountWithBalance[] | null>(null);
  const [totalCents, setTotalCents] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CHECKING');
  const [startingBalance, setStartingBalance] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [actualBalance, setActualBalance] = useState('');
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const load = () => {
    accountsApi
      .balances()
      .then((result) => {
        setAccounts(result.accounts);
        setTotalCents(result.totalCents);
      })
      .catch(() => setError('Konten konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setType('CHECKING');
    setStartingBalance('');
    setFormError(null);
  };

  const startEdit = (account: AccountWithBalance) => {
    setEditingId(account.id);
    setName(account.name);
    setType(account.type);
    setStartingBalance(String(account.startingBalance / 100));
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const dto = {
        name,
        type,
        startingBalance: startingBalance === '' ? undefined : eurosToCents(startingBalance),
      };
      if (editingId) {
        await accountsApi.update(editingId, dto);
      } else {
        await accountsApi.create(dto);
      }
      resetForm();
      load();
    } catch {
      setFormError('Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (account: AccountWithBalance) => {
    await accountsApi.update(account.id, { archived: !account.archived });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Dieses Konto wirklich löschen? Das geht nur, wenn keine Buchungen mehr darauf liegen.'))
      return;
    try {
      await accountsApi.remove(id);
      load();
    } catch {
      window.alert('Löschen fehlgeschlagen — das Konto hat vermutlich noch Buchungen. Stattdessen archivieren?');
    }
  };

  const startReconcile = (accountId: string) => {
    setReconcilingId(accountId);
    setActualBalance('');
    setReconcileMessage(null);
  };

  const handleReconcile = async (e: FormEvent) => {
    e.preventDefault();
    if (!reconcilingId) return;
    setReconciling(true);
    setReconcileMessage(null);
    try {
      const result = await accountsApi.reconcile(reconcilingId, eurosToCents(actualBalance));
      if (result.diff === 0) {
        setReconcileMessage('Saldo stimmt bereits überein — keine Buchung nötig.');
      } else {
        const direction = result.diff > 0 ? 'Ausgleichsbuchung über +' : 'Ausgleichsbuchung über ';
        setReconcileMessage(`${direction}${formatCents(result.diff)} angelegt.`);
      }
      load();
    } catch {
      setReconcileMessage('Abgleich fehlgeschlagen.');
    } finally {
      setReconciling(false);
    }
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!accounts) {
    return <SkeletonList />;
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Konten</h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Jedes Konto führt seinen eigenen Saldo (Startsaldo + eigene Buchungen). Geld zwischen Konten bewegst du per
          Umbuchung, nicht durch Bearbeiten des Startsaldos.
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
              placeholder="z. B. Girokonto"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Typ</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Startsaldo (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="0.00"
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
            {editingId ? 'Speichern' : 'Konto anlegen'}
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
              <th className="px-4 py-2 font-medium">Konto</th>
              <th className="px-4 py-2 font-medium">Saldo</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const Icon = ACCOUNT_TYPE_ICONS[account.type];
              return (
                <Fragment key={account.id}>
                  <tr className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={14} className="text-neutral-400 dark:text-neutral-500" />
                        {account.name}
                        {account.archived && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            archiviert
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                      <Amount cents={account.balanceCents} />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startReconcile(account.id)}
                        className="mr-3 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Abgleichen
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(account)}
                        aria-label="Bearbeiten"
                        className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(account)}
                        aria-label={account.archived ? 'Reaktivieren' : 'Archivieren'}
                        title={account.archived ? 'Reaktivieren' : 'Archivieren'}
                        className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      >
                        {account.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account.id)}
                        aria-label="Löschen"
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                  {reconcilingId === account.id && (
                    <tr className="border-b border-neutral-100 bg-neutral-50 last:border-0 dark:border-neutral-800 dark:bg-neutral-800/50">
                      <td colSpan={3} className="px-4 py-3">
                        <form onSubmit={handleReconcile} className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                              Tatsächlicher Saldo für „{account.name}“ (€)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={actualBalance}
                              onChange={(e) => setActualBalance(e.target.value)}
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
                          <button
                            type="button"
                            onClick={() => setReconcilingId(null)}
                            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                          >
                            Abbrechen
                          </button>
                          {reconcileMessage && (
                            <p className="w-full text-sm text-green-600 dark:text-green-400">{reconcileMessage}</p>
                          )}
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  Noch keine Konten angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {accounts.length > 0 && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Gesamtsaldo:{' '}
          <span className="font-medium">
            <Amount cents={totalCents} />
          </span>
        </p>
      )}
    </div>
  );
}
