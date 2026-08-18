import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiClient } from './client';
import type { User } from './types';

export interface LoginPayload {
  email: string;
  password: string;
  totpCode?: string;
}

export const authApi = {
  login: (payload: LoginPayload) => apiClient.post<User>('/auth/login', payload).then((r) => r.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  webauthnLoginOptions: () =>
    apiClient.post<PublicKeyCredentialRequestOptionsJSON>('/auth/webauthn/login-options').then((r) => r.data),
  webauthnLoginVerify: (body: AuthenticationResponseJSON) =>
    apiClient.post<{ verified: boolean }>('/auth/webauthn/login-verify', body).then((r) => r.data),
};
