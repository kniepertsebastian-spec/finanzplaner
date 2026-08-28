import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

export class TransactionSplitItemDto {
  @IsInt()
  amount: number;

  @IsUUID()
  categoryId: string;
}

export class CreateTransactionSplitDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => TransactionSplitItemDto)
  splits: TransactionSplitItemDto[];
}
