import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { decodeClientDataJSON } from '@simplewebauthn/server/helpers';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { WebauthnLoginVerifyDto } from './dto/webauthn-login-verify.dto';
import { WebauthnService } from './webauthn.service';

jest.mock('@simplewebauthn/server', () => ({
  ...jest.requireActual('@simplewebauthn/server'),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));
jest.mock('@simplewebauthn/server/helpers', () => ({ decodeClientDataJSON: jest.fn() }));
// Replaced with an explicit factory (not just an auto-mock, which still `require()`s the real
// module to learn its shape) so the real implementation — and with it the otplib ->
// @scure/base import chain, which is ESM and Jest's default transform can't parse — never
// actually loads for this spec.
jest.mock('./auth.service', () => ({ AuthService: jest.fn() }));

describe('WebauthnService', () => {
  let service: WebauthnService;
  let prisma: {
    user: { findFirst: jest.Mock };
    authenticator: { findUnique: jest.Mock; update: jest.Mock };
  };
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };
  let authService: { issueJwtCookie: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn() },
      authenticator: { findUnique: jest.fn(), update: jest.fn() },
    };
    redis = { set: jest.fn(), get: jest.fn(), del: jest.fn() };
    authService = { issueJwtCookie: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebauthnService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<WebauthnService>(WebauthnService);
    jest.clearAllMocks();
  });

  describe('generateLoginOptions', () => {
    it('does not look up any particular user — discoverable-credential login has no allowCredentials', async () => {
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: 'chal-1' });

      const options = await service.generateLoginOptions();

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(generateAuthenticationOptions).toHaveBeenCalledWith(
        expect.not.objectContaining({ allowCredentials: expect.anything() }),
      );
      expect(redis.set).toHaveBeenCalledWith('webauthn:login:chal-1', '1', 'EX', expect.any(Number));
      expect(options).toEqual({ challenge: 'chal-1' });
    });
  });

  describe('verifyLogin', () => {
    const baseResponse = {
      id: 'cred-2nd-user',
      response: { clientDataJSON: 'base64url-doesnt-matter-mocked' },
    } as unknown as WebauthnLoginVerifyDto;

    it('logs in the credential owner even when they are not the first user in the table (the fixed bug)', async () => {
      // The whole point of the fix: the authenticator here belongs to "user-2", a user who would
      // never have been found by the old `prisma.user.findFirst()` lookup.
      prisma.authenticator.findUnique.mockResolvedValue({
        id: 'auth-1',
        userId: 'user-2',
        credentialId: 'cred-2nd-user',
        publicKey: Buffer.from('pub'),
        counter: BigInt(0),
        transports: [],
      });
      redis.get.mockResolvedValue('1');
      (decodeClientDataJSON as jest.Mock).mockReturnValue({
        challenge: 'chal-1',
        type: 'webauthn.get',
        origin: 'http://localhost',
      });
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      const res = {} as never;
      const result = await service.verifyLogin(baseResponse, res);

      expect(redis.get).toHaveBeenCalledWith('webauthn:login:chal-1');
      expect(authService.issueJwtCookie).toHaveBeenCalledWith(res, 'user-2');
      expect(redis.del).toHaveBeenCalledWith('webauthn:login:chal-1');
      expect(result).toEqual({ verified: true });
    });

    it('rejects when the credential id is unknown', async () => {
      prisma.authenticator.findUnique.mockResolvedValue(null);

      await expect(service.verifyLogin(baseResponse, {} as never)).rejects.toThrow(UnauthorizedException);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('rejects when the challenge was never issued (or already used/expired)', async () => {
      prisma.authenticator.findUnique.mockResolvedValue({
        id: 'auth-1',
        userId: 'user-2',
        credentialId: 'cred-2nd-user',
      });
      redis.get.mockResolvedValue(null);
      (decodeClientDataJSON as jest.Mock).mockReturnValue({
        challenge: 'stale-or-forged',
        type: 'webauthn.get',
        origin: 'http://localhost',
      });

      await expect(service.verifyLogin(baseResponse, {} as never)).rejects.toThrow(BadRequestException);
      expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
    });
  });
});
