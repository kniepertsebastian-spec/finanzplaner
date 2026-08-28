import { IsISO8601, IsInt, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  fromAccountId: string;

  @IsUUID()
  toAccountId: string;

  // Cents; always positive — direction comes from fromAccountId/toAccountId, not the sign.
  @IsInt()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;
}
