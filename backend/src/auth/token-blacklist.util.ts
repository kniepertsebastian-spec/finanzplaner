import { createHash } from 'node:crypto';

// Keyed by a hash of the token rather than the raw JWT — same lookup behavior, but avoids parking
// full bearer tokens in Redis.
export function tokenBlacklistKey(token: string): string {
  return `jwt:blacklist:${createHash('sha256').update(token).digest('hex')}`;
}
