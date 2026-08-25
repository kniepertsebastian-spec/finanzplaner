import { apiClient } from './client';
import type { Transaction } from './types';

export interface TransactionListParams {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface TransactionInput {
  amount: number;
  description: string;
  date?: string;
  categoryId?: string;
  avoidable?: boolean;
  inefficient?: boolean;
  tooExpensive?: boolean;
  taxRelevant?: boolean;
  tags?: string[];
}

export interface TransactionSplitInput {
  description: string;
  date?: string;
  splits: { amount: number; categoryId: string }[];
}

export interface BulkUpdatePatch {
  categoryId?: string;
  avoidable?: boolean;
  inefficient?: boolean;
  tooExpensive?: boolean;
  taxRelevant?: boolean;
}

export const transactionsApi = {
  list: (params?: TransactionListParams) =>
    apiClient.get<Transaction[]>('/transactions', { params }).then((r) => r.data),
  create: (dto: TransactionInput) => apiClient.post<Transaction>('/transactions', dto).then((r) => r.data),
  createSplit: (dto: TransactionSplitInput) =>
    apiClient.post<Transaction[]>('/transactions/split', dto).then((r) => r.data),
  update: (id: string, dto: Partial<TransactionInput>) =>
    apiClient.patch<Transaction>(`/transactions/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/transactions/${id}`).then((r) => r.data),
  bulkRemove: (ids: string[]) =>
    apiClient.post<{ count: number }>('/transactions/bulk-delete', { ids }).then((r) => r.data),
  bulkUpdate: (ids: string[], patch: BulkUpdatePatch) =>
    apiClient.post<{ count: number }>('/transactions/bulk-update', { ids, patch }).then((r) => r.data),
  taxExportUrl: (year: number) => `${apiClient.defaults.baseURL}/transactions/tax-export?year=${year}`,
};
