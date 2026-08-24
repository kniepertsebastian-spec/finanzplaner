import { Module } from '@nestjs/common';
import { SavingsPotsService } from './savings-pots.service';
import { SavingsPotsController } from './savings-pots.controller';

@Module({
  providers: [SavingsPotsService],
  controllers: [SavingsPotsController],
})
export class SavingsPotsModule {}
