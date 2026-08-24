import { apiClient } from './client';
import type { User } from './types';

export interface ReconcileResult {
  transaction: { id: string; amount: number; description: string } | null;
  previousBalance: number;
  actualBalance: number;
  diff: number;
}

export const usersApi = {
  update: (dto: { monthStartDay?: number; startingBalance?: number }) =>
    apiClient.patch<User>('/users/me', dto).then((r) => r.data),
  getBalance: () => apiClient.get<{ balance: number }>('/users/me/balance').then((r) => r.data),
  reconcile: (actualBalance: number) =>
    apiClient.post<ReconcileResult>('/users/me/reconcile', { actualBalance }).then((r) => r.data),
};
