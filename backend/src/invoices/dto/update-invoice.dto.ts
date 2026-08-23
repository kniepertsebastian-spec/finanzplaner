import { IsBoolean } from 'class-validator';

export class UpdateInvoiceDto {
  @IsBoolean()
  important: boolean;
}
