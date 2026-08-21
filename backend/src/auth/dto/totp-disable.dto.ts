import { IsString, Length } from 'class-validator';

export class TotpDisableDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
