import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class TaxExportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}
