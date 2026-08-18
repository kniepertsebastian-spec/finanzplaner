import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TransactionInput } from './api/transactions';
import type { Budget, Category, Transaction } from './api/types';

export interface PendingTransaction {
  localId?: number;
  input: TransactionInput;
  createdAt: string;
}

interface FinanzDbSchema extends DBSchema {
  categories: { key: string; value: Category };
  transactions: { key: string; value: Transaction };
  budgets: { key: string; value: Budget };
  pendingTransactions: { key: number; value: PendingTransaction };
}

type CacheStore = 'categories' | 'transactions' | 'budgets';

let dbPromise: Promise<IDBPDatabase<FinanzDbSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<FinanzDbSchema>('finanz-pwa', 1, {
      upgrade(db) {
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('transactions', { keyPath: 'id' });
        db.createObjectStore('budgets', { keyPath: 'id' });
        db.createObjectStore('pendingTransactions', { keyPath: 'localId', autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

async function cacheAll<S extends CacheStore>(store: S, items: FinanzDbSchema[S]['value'][]) {
  const db = await getDb();
  const tx = db.transaction(store, 'readwrite');
  await tx.store.clear();
  await Promise.all(items.map((item) => tx.store.put(item)));
  await tx.done;
}

async function getCached<S extends CacheStore>(store: S): Promise<FinanzDbSchema[S]['value'][]> {
  const db = await getDb();
  return db.getAll(store);
}

export async function listWithCache<S extends CacheStore>(
  store: S,
  fetcher: () => Promise<FinanzDbSchema[S]['value'][]>,
): Promise<FinanzDbSchema[S]['value'][]> {
  try {
    const result = await fetcher();
    await cacheAll(store, result);
    return result;
  } catch (err) {
    const cached = await getCached(store);
    if (cached.length > 0) {
      return cached;
    }
    throw err;
  }
}

export async function addPendingTransaction(input: TransactionInput): Promise<number> {
  const db = await getDb();
  return db.add('pendingTransactions', { input, createdAt: new Date().toISOString() });
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDb();
  return db.getAll('pendingTransactions');
}

export async function removePendingTransaction(localId: number): Promise<void> {
  const db = await getDb();
  await db.delete('pendingTransactions', localId);
}

export async function countPendingTransactions(): Promise<number> {
  const db = await getDb();
  return db.count('pendingTransactions');
}
