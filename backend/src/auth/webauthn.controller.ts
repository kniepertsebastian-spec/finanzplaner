import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { WebauthnLoginVerifyDto } from './dto/webauthn-login-verify.dto';
import { WebauthnRegistrationVerifyDto } from './dto/webauthn-registration-verify.dto';
import { WebauthnService } from './webauthn.service';

@Controller('auth/webauthn')
export class WebauthnController {
  constructor(private readonly webauthnService: WebauthnService) {}

  @Post('register-options')
  registerOptions(@CurrentUser() user: { id: string }) {
    return this.webauthnService.generateRegistrationOptions(user.id);
  }

  @Post('register-verify')
  registerVerify(@CurrentUser() user: { id: string }, @Body() body: WebauthnRegistrationVerifyDto) {
    return this.webauthnService.verifyRegistration(user.id, body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login-options')
  loginOptions() {
    return this.webauthnService.generateLoginOptions();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login-verify')
  loginVerify(@Body() body: WebauthnLoginVerifyDto, @Res({ passthrough: true }) res: Response) {
    return this.webauthnService.verifyLogin(body, res);
  }
}
