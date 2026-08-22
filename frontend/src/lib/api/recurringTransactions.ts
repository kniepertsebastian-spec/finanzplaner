import { apiClient } from './client';
import type { RecurringTransaction } from './types';

export interface RecurringTransactionInput {
  amount: number;
  description: string;
  categoryId: string;
  dayOfMonth: number;
  intervalMonths?: number;
  active?: boolean;
}

export const recurringTransactionsApi = {
  list: () => apiClient.get<RecurringTransaction[]>('/recurring-transactions').then((r) => r.data),
  create: (dto: RecurringTransactionInput) =>
    apiClient.post<RecurringTransaction>('/recurring-transactions', dto).then((r) => r.data),
  update: (id: string, dto: Partial<RecurringTransactionInput>) =>
    apiClient.patch<RecurringTransaction>(`/recurring-transactions/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/recurring-transactions/${id}`).then((r) => r.data),
};
