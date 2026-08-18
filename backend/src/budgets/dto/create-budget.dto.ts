import { IsISO8601, IsInt, IsPositive, IsUUID } from 'class-validator';

export class CreateBudgetDto {
  @IsInt()
  @IsPositive()
  amount: number;

  // First-of-month UTC midnight, e.g. "2026-08-01T00:00:00.000Z"
  @IsISO8601()
  month: string;

  @IsUUID()
  categoryId: string;
}
