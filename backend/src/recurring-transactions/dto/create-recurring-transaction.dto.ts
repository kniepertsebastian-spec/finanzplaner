import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateRecurringTransactionDto {
  @IsInt()
  amount: number;

  @IsString()
  @MinLength(1)
  description: string;

  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
