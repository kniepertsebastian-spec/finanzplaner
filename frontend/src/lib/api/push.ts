import { apiClient } from './client';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushApi = {
  getPublicKey: () => apiClient.get<{ publicKey: string | null }>('/push/vapid-public-key').then((r) => r.data),
  subscribe: (subscription: PushSubscriptionInput) =>
    apiClient.post('/push/subscribe', subscription).then((r) => r.data),
  unsubscribe: (endpoint: string) => apiClient.delete('/push/subscribe', { data: { endpoint } }).then((r) => r.data),
};
