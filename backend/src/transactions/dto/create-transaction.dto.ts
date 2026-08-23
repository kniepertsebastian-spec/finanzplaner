import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTransactionDto {
  @IsInt()
  amount: number;

  @IsString()
  @MinLength(1)
  description: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  avoidable?: boolean;

  @IsOptional()
  @IsBoolean()
  inefficient?: boolean;

  @IsOptional()
  @IsBoolean()
  tooExpensive?: boolean;
}
