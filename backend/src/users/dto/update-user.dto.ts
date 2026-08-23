import { IsInt, Max, Min } from 'class-validator';

export class UpdateUserDto {
  @IsInt()
  @Min(1)
  @Max(31)
  monthStartDay: number;
}
