import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: { id: string }, @Body() dto: SubscribePushDto) {
    return this.pushService.subscribe(user.id, dto);
  }

  @Delete('subscribe')
  unsubscribe(@CurrentUser() user: { id: string }, @Body() dto: UnsubscribePushDto) {
    return this.pushService.unsubscribe(user.id, dto.endpoint);
  }
}
