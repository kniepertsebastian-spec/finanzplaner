import { Type } from 'class-transformer';
import { IsString, MinLength, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  @MinLength(1)
  p256dh: string;

  @IsString()
  @MinLength(1)
  auth: string;
}

// Mirrors the browser's PushSubscriptionJSON shape (endpoint + keys.p256dh/auth) — passed through
// as-is from `PushSubscription.toJSON()` on the frontend, no reshaping needed.
export class SubscribePushDto {
  @IsString()
  @MinLength(1)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
