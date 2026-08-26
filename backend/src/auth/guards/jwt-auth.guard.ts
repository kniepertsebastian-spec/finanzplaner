import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { tokenBlacklistKey } from '../token-blacklist.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    // Catches a token that's still cryptographically valid but was explicitly revoked at logout
    // (see AuthService.logout) — signature verification alone can't detect that.
    const isRevoked = await this.redis.get(tokenBlacklistKey(token));
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    request.user = { id: payload.sub };
    return true;
  }
}
