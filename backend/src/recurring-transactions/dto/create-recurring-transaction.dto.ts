import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateRecurringTransactionDto {
  @IsInt()
  amount: number;

  @IsString()
  @MinLength(1)
  description: string;

  @IsUUID()
  categoryId: string;

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
}
