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
}

export const transactionsApi = {
  list: (params?: TransactionListParams) =>
    apiClient.get<Transaction[]>('/transactions', { params }).then((r) => r.data),
  create: (dto: TransactionInput) => apiClient.post<Transaction>('/transactions', dto).then((r) => r.data),
  update: (id: string, dto: Partial<TransactionInput>) =>
    apiClient.patch<Transaction>(`/transactions/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/transactions/${id}`).then((r) => r.data),
};
