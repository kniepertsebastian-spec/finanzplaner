import { IsString, MinLength } from 'class-validator';

export class UnsubscribePushDto {
  @IsString()
  @MinLength(1)
  endpoint: string;
}
