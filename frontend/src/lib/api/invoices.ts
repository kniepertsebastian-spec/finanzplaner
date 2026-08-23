import { apiClient } from './client';
import type { Invoice } from './types';

export const invoicesApi = {
  list: () => apiClient.get<Invoice[]>('/invoices').then((r) => r.data),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<Invoice>('/invoices', formData).then((r) => r.data);
  },
  update: (id: string, dto: { important: boolean }) =>
    apiClient.patch<Invoice>(`/invoices/${id}`, dto).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/invoices/${id}`).then((r) => r.data),
  fileUrl: (id: string) => `${apiClient.defaults.baseURL}/invoices/${id}/file`,
};
