import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

// otplib pulls in @scure/base transitively, which is ESM-only and Jest's default (non-ESM)
// transform can't parse — same issue worked around in webauthn.service.spec.ts. auth.service.ts
// only calls `verify`, so that's all that needs stubbing here.
jest.mock('otplib', () => ({ verify: jest.fn() }));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { decode: jest.Mock; sign: jest.Mock };
  let redis: { set: jest.Mock };

  beforeEach(async () => {
    jwtService = { decode: jest.fn(), sign: jest.fn() };
    redis = { set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: jwtService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('logout', () => {
    const res = { clearCookie: jest.fn() } as unknown as Parameters<AuthService['logout']>[0];

    it('clears the cookie and blacklists the token for its remaining TTL', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      jwtService.decode.mockReturnValue({ exp: nowSeconds + 120, sub: 'user-1' });

      const result = await service.logout(res, 'the.jwt.token');

      expect((res as unknown as { clearCookie: jest.Mock }).clearCookie).toHaveBeenCalledWith('auth_token');
      expect(redis.set).toHaveBeenCalledTimes(1);
      const [key, value, mode, ttl] = redis.set.mock.calls[0];
      expect(key).toMatch(/^jwt:blacklist:[0-9a-f]{64}$/); // sha256 hex of the token, not the raw token
      expect(value).toBe('revoked');
      expect(mode).toBe('EX');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);
      expect(result).toEqual({ success: true });
    });

    it('does nothing when no token is given (e.g. cookie already missing)', async () => {
      const result = await service.logout(res, undefined);

      expect(redis.set).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('does not blacklist a token that has already expired', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      jwtService.decode.mockReturnValue({ exp: nowSeconds - 10, sub: 'user-1' });

      await service.logout(res, 'already-expired.jwt.token');

      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
