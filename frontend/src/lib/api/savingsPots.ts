import { apiClient } from './client';
import type { SavingsPot } from './types';

export interface SavingsPotInput {
  name: string;
  amountCents?: number;
  targetCents?: number;
}

export const savingsPotsApi = {
  list: () => apiClient.get<SavingsPot[]>('/savings-pots').then((r) => r.data),
  create: (dto: SavingsPotInput) => apiClient.post<SavingsPot>('/savings-pots', dto).then((r) => r.data),
  update: (id: string, dto: Partial<SavingsPotInput>) =>
    apiClient.patch<SavingsPot>(`/savings-pots/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/savings-pots/${id}`).then((r) => r.data),
};
