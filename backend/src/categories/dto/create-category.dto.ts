import { BudgetType } from '../../../generated/prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(BudgetType)
  budgetType?: BudgetType | null;
}
