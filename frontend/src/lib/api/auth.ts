import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { apiClient } from './client';
import type { Authenticator, User } from './types';

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
  webauthnRegisterOptions: () =>
    apiClient.post<PublicKeyCredentialCreationOptionsJSON>('/auth/webauthn/register-options').then((r) => r.data),
  webauthnRegisterVerify: (body: RegistrationResponseJSON & { deviceName?: string }) =>
    apiClient.post<{ verified: boolean }>('/auth/webauthn/register-verify', body).then((r) => r.data),
  webauthnListAuthenticators: () =>
    apiClient.get<Authenticator[]>('/auth/webauthn/authenticators').then((r) => r.data),
  webauthnDeleteAuthenticator: (id: string) =>
    apiClient.delete(`/auth/webauthn/authenticators/${id}`).then((r) => r.data),
  totpEnroll: () =>
    apiClient.post<{ qrCodeDataUrl: string; secret: string }>('/auth/totp/enroll').then((r) => r.data),
  totpVerifyEnable: (code: string) =>
    apiClient.post<{ success: boolean }>('/auth/totp/verify-enable', { code }).then((r) => r.data),
  totpDisable: (code: string) =>
    apiClient.post<{ success: boolean }>('/auth/totp/disable', { code }).then((r) => r.data),
};
