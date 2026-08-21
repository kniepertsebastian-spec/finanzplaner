import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { TotpDisableDto } from './dto/totp-disable.dto';
import { TotpVerifyDto } from './dto/totp-verify.dto';
import { TotpService } from './totp.service';

@Controller('auth/totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @Post('enroll')
  enroll(@CurrentUser() user: { id: string }) {
    return this.totpService.enroll(user.id);
  }

  @Post('verify-enable')
  verifyEnable(@CurrentUser() user: { id: string }, @Body() dto: TotpVerifyDto) {
    return this.totpService.verifyAndEnable(user.id, dto.code);
  }

  @Post('disable')
  disable(@CurrentUser() user: { id: string }, @Body() dto: TotpDisableDto) {
    return this.totpService.disable(user.id, dto.code);
  }
}
