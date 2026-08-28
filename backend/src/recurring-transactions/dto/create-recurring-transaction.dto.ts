import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRecurringTransactionDto {
  @IsInt()
  amount: number;

  @IsString()
  @MinLength(1)
  description: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsDateString()
  nextDueDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  intervalMonths?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  avoidable?: boolean;

  @IsOptional()
  @IsBoolean()
  inefficient?: boolean;

  @IsOptional()
  @IsBoolean()
  tooExpensive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contractNumber?: string;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cancellationPeriodDays?: number;
}
