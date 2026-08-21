import type { RegistrationResponseJSON } from '@simplewebauthn/server';

// Intentionally a type alias, not a class: the browser's RegistrationResponseJSON is a deeply
// nested object verified cryptographically by @simplewebauthn/server itself. Typing it as a class
// would make the global ValidationPipe's `whitelist: true` strip unrecognized nested fields;
// keeping it a plain type means Nest's ValidationPipe skips it entirely and passes it through as-is.
// `deviceName` rides along in the same request body (e.g. "iPhone von Alex") purely for display
// in the settings UI — it's never involved in the cryptographic verification itself.
export type WebauthnRegistrationVerifyDto = RegistrationResponseJSON & { deviceName?: string };
