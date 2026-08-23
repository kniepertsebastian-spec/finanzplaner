import { apiClient } from './client';
import type { User } from './types';

export const usersApi = {
  update: (dto: { monthStartDay: number }) => apiClient.patch<User>('/users/me', dto).then((r) => r.data),
};
