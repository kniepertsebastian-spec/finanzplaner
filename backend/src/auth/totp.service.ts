import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import * as QRCode from 'qrcode';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { decryptSecret, encryptSecret } from './crypto.util';

const ENROLL_TTL_SECONDS = 600;
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;
const enrollKey = (userId: string) => `totp:enroll:${userId}`;

@Injectable()
export class TotpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async enroll(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const secret = generateSecret();
    const uri = generateURI({ issuer: 'Finanzplaner', label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    await this.redis.set(enrollKey(userId), secret, 'EX', ENROLL_TTL_SECONDS);
    return { qrCodeDataUrl, secret };
  }

  async verifyAndEnable(userId: string, code: string) {
    const pendingSecret = await this.redis.get(enrollKey(userId));
    if (!pendingSecret) {
      throw new BadRequestException('No pending TOTP enrollment, request a new QR code first');
    }

    const result = await verifyTotp({
      secret: pendingSecret,
      token: code,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: encryptSecret(pendingSecret), totpEnabled: true },
    });
    await this.redis.del(enrollKey(userId));
    return { success: true };
  }

  // Requires a currently-valid code rather than just the session cookie — disabling 2FA is
  // security-sensitive enough to warrant proving live possession of the authenticator, unlike
  // deleting a passkey (see the comment in webauthn.service.ts's deleteAuthenticator).
  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabled || !user.totpSecretEncrypted) {
      throw new BadRequestException('TOTP is not enabled');
    }

    const secret = decryptSecret(user.totpSecretEncrypted);
    const result = await verifyTotp({
      secret,
      token: code,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: null, totpEnabled: false },
    });
    return { success: true };
  }
}
