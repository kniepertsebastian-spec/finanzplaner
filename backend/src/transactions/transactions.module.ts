import { Module } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  providers: [TransactionsService, CategorizationService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
