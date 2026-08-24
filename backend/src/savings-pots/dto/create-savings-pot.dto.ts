import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSavingsPotDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetCents?: number;
}
