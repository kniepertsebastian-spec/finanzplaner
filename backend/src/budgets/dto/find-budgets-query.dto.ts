import { IsISO8601, IsOptional } from 'class-validator';

export class FindBudgetsQueryDto {
  @IsOptional()
  @IsISO8601()
  month?: string;
}
