import { apiClient } from './client';
import type { BudgetType, Category } from './types';

export interface CategoryInput {
  name: string;
  budgetType?: BudgetType | null;
}

export const categoriesApi = {
  list: () => apiClient.get<Category[]>('/categories').then((r) => r.data),
  create: (dto: CategoryInput) => apiClient.post<Category>('/categories', dto).then((r) => r.data),
  update: (id: string, dto: Partial<CategoryInput>) =>
    apiClient.patch<Category>(`/categories/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/categories/${id}`).then((r) => r.data),
};
