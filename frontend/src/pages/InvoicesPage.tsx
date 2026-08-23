import clsx from 'clsx';
import { ExternalLink, Star, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { invoicesApi } from '../lib/api/invoices';
import type { Invoice } from '../lib/api/types';

const RETENTION_DAYS = 30;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysRemaining(uploadedAt: string): number {
  const uploaded = new Date(uploadedAt).getTime();
  const elapsedDays = Math.floor((Date.now() - uploaded) / (24 * 60 * 60 * 1000));
  return Math.max(RETENTION_DAYS - elapsedDays, 0);
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    invoicesApi
      .list()
      .then(setInvoices)
      .catch(() => setError('Rechnungen konnten nicht geladen werden.'));
  };

  useEffect(load, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await invoicesApi.upload(file);
      load();
    } catch {
      setUploadError('Upload fehlgeschlagen (nur PDF, JPEG, PNG, HEIC, max. 10 MB).');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleImportant = async (invoice: Invoice) => {
    await invoicesApi.update(invoice.id, { important: !invoice.important });
    load();
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!window.confirm(`"${invoice.filename}" wirklich löschen?`)) return;
    await invoicesApi.remove(invoice.id);
    load();
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!invoices) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Lädt…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Rechnungen</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Belege werden nach {RETENTION_DAYS} Tagen automatisch gelöscht, außer sie sind als wichtig markiert.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id="invoice-upload"
        />
        <label
          htmlFor="invoice-upload"
          className={clsx(
            'flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 py-6 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800',
            uploading && 'pointer-events-none opacity-50',
          )}
        >
          <Upload size={18} />
          {uploading ? 'Wird hochgeladen…' : 'Beleg hochladen (PDF, JPEG, PNG, HEIC)'}
        </label>
        {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Datei</th>
              <th className="px-4 py-2 font-medium">Hochgeladen</th>
              <th className="px-4 py-2 font-medium">Größe</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  <a
                    href={invoicesApi.fileUrl(invoice.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:underline"
                  >
                    {invoice.filename}
                    <ExternalLink size={12} />
                  </a>
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {dateFormatter.format(new Date(invoice.uploadedAt))}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{formatBytes(invoice.size)}</td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">
                  {invoice.important ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      Wichtig
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        'text-xs',
                        daysRemaining(invoice.uploadedAt) <= 7
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-neutral-500 dark:text-neutral-400',
                      )}
                    >
                      löscht in {daysRemaining(invoice.uploadedAt)} Tagen
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleImportant(invoice)}
                    aria-label={invoice.important ? 'Als wichtig entfernen' : 'Als wichtig markieren'}
                    className="mr-2 rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Star size={16} fill={invoice.important ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(invoice)}
                    aria-label="Löschen"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500">
                  Noch keine Rechnungen hochgeladen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
