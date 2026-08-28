import { apiClient } from './client';
import type { Account, AccountBalances, AccountType } from './types';

export interface AccountInput {
  name: string;
  type?: AccountType;
  startingBalance?: number;
}

export interface ReconcileResult {
  transaction: { id: string; amount: number; description: string } | null;
  previousBalance: number;
  actualBalance: number;
  diff: number;
}

export const accountsApi = {
  list: (includeArchived = false) =>
    apiClient
      .get<Account[]>('/accounts', { params: includeArchived ? { includeArchived: 'true' } : undefined })
      .then((r) => r.data),
  balances: () => apiClient.get<AccountBalances>('/accounts/balances').then((r) => r.data),
  create: (dto: AccountInput) => apiClient.post<Account>('/accounts', dto).then((r) => r.data),
  update: (id: string, dto: Partial<AccountInput> & { archived?: boolean }) =>
    apiClient.patch<Account>(`/accounts/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/accounts/${id}`).then((r) => r.data),
  reconcile: (id: string, actualBalance: number) =>
    apiClient.post<ReconcileResult>(`/accounts/${id}/reconcile`, { actualBalance }).then((r) => r.data),
};
