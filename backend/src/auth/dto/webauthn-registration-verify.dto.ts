import type { RegistrationResponseJSON } from '@simplewebauthn/server';

// Intentionally a type alias, not a class: the browser's RegistrationResponseJSON is a deeply
// nested object verified cryptographically by @simplewebauthn/server itself. Typing it as a class
// would make the global ValidationPipe's `whitelist: true` strip unrecognized nested fields;
// keeping it a plain type means Nest's ValidationPipe skips it entirely and passes it through as-is.
export type WebauthnRegistrationVerifyDto = RegistrationResponseJSON;
