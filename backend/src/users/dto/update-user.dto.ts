import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  monthStartDay?: number;
}
