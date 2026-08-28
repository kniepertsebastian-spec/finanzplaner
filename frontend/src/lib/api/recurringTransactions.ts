import { apiClient } from './client';
import type { RecurringTransaction } from './types';

export interface RecurringTransactionInput {
  amount: number;
  description: string;
  categoryId: string;
  accountId: string;
  nextDueDate: string; // ISO date, e.g. "2026-10-15"
  intervalMonths?: number;
  active?: boolean;
  avoidable?: boolean;
  inefficient?: boolean;
  tooExpensive?: boolean;
  contractNumber?: string;
  contractEndDate?: string;
  cancellationPeriodDays?: number;
}

export const recurringTransactionsApi = {
  list: () => apiClient.get<RecurringTransaction[]>('/recurring-transactions').then((r) => r.data),
  create: (dto: RecurringTransactionInput) =>
    apiClient.post<RecurringTransaction>('/recurring-transactions', dto).then((r) => r.data),
  update: (id: string, dto: Partial<RecurringTransactionInput>) =>
    apiClient.patch<RecurringTransaction>(`/recurring-transactions/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/recurring-transactions/${id}`).then((r) => r.data),
  dismissPriceIncrease: (id: string) =>
    apiClient.post<RecurringTransaction>(`/recurring-transactions/${id}/dismiss-price-increase`).then((r) => r.data),
};
