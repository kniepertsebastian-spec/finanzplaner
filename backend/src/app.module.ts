import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { BudgetsModule } from './budgets/budgets.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    BudgetsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
