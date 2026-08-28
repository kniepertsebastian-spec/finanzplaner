import { AccountType } from '../../../generated/prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  // Cents; opening balance before any tracked transactions for this account existed.
  @IsOptional()
  @IsInt()
  startingBalance?: number;
}
