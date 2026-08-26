import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verify: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let redis: { get: jest.Mock };

  const buildContext = (token?: string): ExecutionContext => {
    const request: { cookies: Record<string, string>; user?: { id: string } } = { cookies: {} };
    if (token) request.cookies.auth_token = token;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    redis = { get: jest.fn() };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService, reflector as unknown as Reflector, redis as never);
  });

  it('allows a public route through without checking the token at all', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('rejects when there is no auth cookie', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid or expired token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(guard.canActivate(buildContext('bad.token'))).rejects.toThrow(UnauthorizedException);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('rejects a validly-signed token that was blacklisted at logout', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    redis.get.mockResolvedValue('revoked');

    await expect(guard.canActivate(buildContext('revoked.token'))).rejects.toThrow(UnauthorizedException);
  });

  it('allows a valid, non-blacklisted token and attaches the user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    redis.get.mockResolvedValue(null);
    const context = buildContext('good.token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual({ id: 'user-1' });
  });
});
