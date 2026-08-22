import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { categoriesApi } from '../../lib/api/categories';
import type { Category } from '../../lib/api/types';

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch(() => setError('Kategorien konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await categoriesApi.create({ name: name.trim() });
      setName('');
      load();
    } catch {
      setFormError('Anlegen fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!window.confirm(`Kategorie "${category.name}" wirklich löschen?`)) return;
    try {
      await categoriesApi.remove(category.id);
      load();
    } catch {
      window.alert('Löschen fehlgeschlagen — die Kategorie wird noch von Buchungen, Budgets oder Regeln verwendet.');
    }
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!categories) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Kategorien</h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Lebensmittel"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>
      {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between py-2">
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{category.name}</span>
            <button
              type="button"
              onClick={() => handleDelete(category)}
              aria-label={`Kategorie "${category.name}" löschen`}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">
            Noch keine Kategorien angelegt.
          </li>
        )}
      </ul>
    </div>
  );
}
