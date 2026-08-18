import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import * as argon2 from 'argon2';
import { verify as verifyTotp } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from './crypto.util';
import { LoginDto } from './dto/login.dto';

const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.totpEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('TOTP code required');
      }
      const secret = decryptSecret(user.totpSecretEncrypted);
      const result = await verifyTotp({
        secret,
        token: dto.totpCode,
        epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
      });
      if (!result.valid) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    this.issueJwtCookie(res, user.id);
    return { id: user.id, email: user.email };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email };
  }

  logout(res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME);
    return { success: true };
  }

  issueJwtCookie(res: Response, userId: string) {
    const token = this.jwtService.sign({ sub: userId });
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
    });
  }
}
