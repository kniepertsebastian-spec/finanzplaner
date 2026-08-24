import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TransactionsModule],
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule {}
