import { IsInt } from 'class-validator';

export class ReconcileBalanceDto {
  @IsInt()
  actualBalance: number; // Cents; the real balance the user read off their bank
}
