import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUUID, ValidateNested } from 'class-validator';

// Bulk edits only cover fields that make sense applied identically to many transactions at once —
// category and the three flags. Amount/description/date stay single-transaction-only edits.
export class BulkUpdateTransactionsPatchDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  avoidable?: boolean;

  @IsOptional()
  @IsBoolean()
  inefficient?: boolean;

  @IsOptional()
  @IsBoolean()
  tooExpensive?: boolean;
}

export class BulkUpdateTransactionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @ValidateNested()
  @Type(() => BulkUpdateTransactionsPatchDto)
  patch: BulkUpdateTransactionsPatchDto;
}
