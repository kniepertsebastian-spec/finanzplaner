import { isAxiosError } from 'axios';
import clsx from 'clsx';
import { Camera, Globe, Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { categoriesApi } from '../lib/api/categories';
import { transactionsApi, type TransactionInput } from '../lib/api/transactions';
import type { Category } from '../lib/api/types';
import { COMMON_CURRENCIES, convertForeignToEuroCents, getRememberedRate, rememberRate } from '../lib/currency';
import { addPendingTransaction, listWithCache } from '../lib/offlineDb';
import { eurosToCents } from '../lib/money';
import { recognizeReceiptText } from '../lib/ocr';
import { parseReceiptText } from '../lib/receiptParse';
import { matchCategoryId, parseVoiceTranscript } from '../lib/voiceParse';

const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

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

  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [showConverter, setShowConverter] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(COMMON_CURRENCIES[0].code);
  const [foreignAmount, setForeignAmount] = useState('');
  const [rate, setRate] = useState(() => getRememberedRate(COMMON_CURRENCIES[0].code));

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const startListening = () => {
    if (!SpeechRecognitionCtor) return;
    setVoiceError(null);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      const { amountEuros, description: parsedDescription } = parseVoiceTranscript(transcript);
      if (amountEuros) setAmount(amountEuros);
      setDescription(parsedDescription);
      if (categories) {
        const matchedCategoryId = matchCategoryId(transcript, categories);
        if (matchedCategoryId) setCategoryId(matchedCategoryId);
      }
    };
    recognition.onerror = () => {
      setVoiceError('Spracherkennung fehlgeschlagen — bitte Mikrofonzugriff erlauben und erneut versuchen.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const handleCurrencyChange = (code: string) => {
    setCurrencyCode(code);
    setRate(getRememberedRate(code));
  };

  const foreignAmountNumber = Number(foreignAmount);
  const rateNumber = Number(rate);
  const convertedCents =
    foreignAmount && rate && Number.isFinite(foreignAmountNumber) && Number.isFinite(rateNumber)
      ? convertForeignToEuroCents(foreignAmountNumber, rateNumber)
      : null;

  const handleApplyConversion = () => {
    if (convertedCents == null) return;
    rememberRate(currencyCode, rate);
    setAmount((convertedCents / 100).toFixed(2));
    setForeignAmount('');
    setShowConverter(false);
  };

  const handleReceiptSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError(null);
    setScanning(true);
    setScanProgress(0);
    try {
      const text = await recognizeReceiptText(file, setScanProgress);
      const parsed = parseReceiptText(text);
      if (parsed.amountEuros) setAmount(parsed.amountEuros);
      if (parsed.date) setDate(parsed.date);
      if (parsed.merchant) setDescription(parsed.merchant);
      if (categories) {
        const matchedCategoryId = matchCategoryId(text, categories);
        if (matchedCategoryId) setCategoryId(matchedCategoryId);
      }
      if (!parsed.amountEuros && !parsed.date && !parsed.merchant) {
        setScanError('Auf dem Beleg konnten keine Daten erkannt werden — bitte manuell ausfüllen.');
      }
    } catch {
      setScanError('Beleg-Scan fehlgeschlagen — bitte manuell ausfüllen.');
    } finally {
      setScanning(false);
    }
  };

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

    const cents = Math.abs(eurosToCents(amount));
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Transaktion hinzufügen</h2>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => receiptInputRef.current?.click()}
              disabled={scanning}
              aria-label="Beleg scannen"
              className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <Camera size={14} />
              {scanning ? `Scannt… ${Math.round(scanProgress * 100)}%` : 'Beleg scannen'}
            </button>
            {SpeechRecognitionCtor && (
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                aria-label={listening ? 'Spracheingabe stoppen' : 'Per Sprache ausfüllen'}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                  listening
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                )}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
                {listening ? 'Hört zu…' : 'Sprechen'}
              </button>
            )}
          </div>
        </div>
        {voiceError && <p className="text-sm text-red-600 dark:text-red-400">{voiceError}</p>}
        {scanError && <p className="text-sm text-red-600 dark:text-red-400">{scanError}</p>}

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
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Betrag (€)</label>
            <button
              type="button"
              onClick={() => setShowConverter((v) => !v)}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <Globe size={12} />
              Fremdwährung
            </button>
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />

          {showConverter && (
            <div className="mt-2 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={currencyCode}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={foreignAmount}
                  onChange={(e) => setForeignAmount(e.target.value)}
                  placeholder={`Betrag in ${currencyCode}`}
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-500 dark:text-neutral-400">
                  1 {currencyCode} =
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="Kurs in €"
                  className="w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">€</span>
              </div>
              {convertedCents != null && (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  ≈ {(convertedCents / 100).toFixed(2)} €
                </p>
              )}
              <button
                type="button"
                onClick={handleApplyConversion}
                disabled={convertedCents == null}
                className="rounded-md bg-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-600 dark:hover:bg-neutral-500"
              >
                In Betrag (€) übernehmen
              </button>
            </div>
          )}
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
