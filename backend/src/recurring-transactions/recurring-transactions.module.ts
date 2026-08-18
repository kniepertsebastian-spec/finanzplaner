import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionsController } from './recurring-transactions.controller';

@Module({
  imports: [TransactionsModule],
  providers: [RecurringTransactionsService],
  controllers: [RecurringTransactionsController],
})
export class RecurringTransactionsModule {}
