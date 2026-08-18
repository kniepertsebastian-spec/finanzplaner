import { apiClient } from './client';
import type { Budget } from './types';

export interface BudgetListParams {
  month?: string;
}

export interface BudgetInput {
  amount: number;
  month: string;
  categoryId: string;
}

export const budgetsApi = {
  list: (params?: BudgetListParams) => apiClient.get<Budget[]>('/budgets', { params }).then((r) => r.data),
  create: (dto: BudgetInput) => apiClient.post<Budget>('/budgets', dto).then((r) => r.data),
  update: (id: string, dto: Partial<BudgetInput>) =>
    apiClient.patch<Budget>(`/budgets/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/budgets/${id}`).then((r) => r.data),
};
