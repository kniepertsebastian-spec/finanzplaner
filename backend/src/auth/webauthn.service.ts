import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type Redis from 'ioredis';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { AuthService } from './auth.service';
import { WebauthnRegistrationVerifyDto } from './dto/webauthn-registration-verify.dto';
import { WebauthnLoginVerifyDto } from './dto/webauthn-login-verify.dto';

const CHALLENGE_TTL_SECONDS = 300;
const registrationChallengeKey = (userId: string) => `webauthn:reg:${userId}`;
const loginChallengeKey = (userId: string) => `webauthn:login:${userId}`;

@Injectable()
export class WebauthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private get rpID() {
    return process.env.WEBAUTHN_RP_ID;
  }
  private get rpName() {
    return process.env.WEBAUTHN_RP_NAME;
  }
  private get origin() {
    return process.env.WEBAUTHN_ORIGIN;
  }

  async generateRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { authenticators: true },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userID: Buffer.from(user.id),
      userDisplayName: user.email,
      attestationType: 'none',
      excludeCredentials: user.authenticators.map((a) => ({
        id: a.credentialId,
        transports: a.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    await this.redis.set(registrationChallengeKey(userId), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
    return options;
  }

  async verifyRegistration(userId: string, response: WebauthnRegistrationVerifyDto) {
    const expectedChallenge = await this.redis.get(registrationChallengeKey(userId));
    if (!expectedChallenge) {
      throw new BadRequestException('No pending passkey registration, request new options first');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Passkey registration could not be verified');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await this.prisma.authenticator.create({
      data: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
        credentialDeviceType,
        credentialBackedUp,
        deviceName: response.deviceName?.trim() || null,
        userId,
      },
    });
    await this.redis.del(registrationChallengeKey(userId));
    return { verified: true };
  }

  listAuthenticators(userId: string) {
    return this.prisma.authenticator.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        deviceName: true,
        credentialDeviceType: true,
        transports: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async deleteAuthenticator(userId: string, id: string) {
    // Password login always remains available (User.passwordHash is required), so there's no
    // lockout risk in letting a user delete their last passkey — unlike disabling TOTP, this
    // doesn't need a fresh credential check to confirm.
    const authenticator = await this.prisma.authenticator.findFirst({ where: { id, userId } });
    if (!authenticator) {
      throw new NotFoundException('Passkey not found');
    }
    await this.prisma.authenticator.delete({ where: { id } });
    return { success: true };
  }

  async generateLoginOptions() {
    const user = await this.prisma.user.findFirst({ include: { authenticators: true } });
    if (!user || user.authenticators.length === 0) {
      throw new BadRequestException('No passkeys registered yet');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: user.authenticators.map((a) => ({
        id: a.credentialId,
        transports: a.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });

    await this.redis.set(loginChallengeKey(user.id), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
    return options;
  }

  async verifyLogin(response: WebauthnLoginVerifyDto, res: Response) {
    const authenticator = await this.prisma.authenticator.findUnique({
      where: { credentialId: response.id },
    });
    if (!authenticator) {
      throw new UnauthorizedException('Unknown passkey');
    }

    const expectedChallenge = await this.redis.get(loginChallengeKey(authenticator.userId));
    if (!expectedChallenge) {
      throw new BadRequestException('No pending login challenge, request new options first');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: authenticator.credentialId,
        publicKey: new Uint8Array(authenticator.publicKey),
        counter: Number(authenticator.counter),
        transports: authenticator.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey login could not be verified');
    }

    await this.prisma.authenticator.update({
      where: { id: authenticator.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });
    await this.redis.del(loginChallengeKey(authenticator.userId));

    this.authService.issueJwtCookie(res, authenticator.userId);
    return { verified: true };
  }
}
