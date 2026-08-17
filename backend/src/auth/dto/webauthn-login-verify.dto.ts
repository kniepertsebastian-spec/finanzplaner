import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

// See webauthn-registration-verify.dto.ts for why this stays a type alias, not a class.
export type WebauthnLoginVerifyDto = AuthenticationResponseJSON;
