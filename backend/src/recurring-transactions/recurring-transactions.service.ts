import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';

@Injectable()
export class RecurringTransactionsService {
  private readonly logger = new Logger(RecurringTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  private async assertCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new ForbiddenException('Category does not belong to the current user');
    }
  }

  async create(userId: string, dto: CreateRecurringTransactionDto) {
    await this.assertCategoryOwnership(userId, dto.categoryId);
    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        amount: dto.amount,
        description: dto.description,
        categoryId: dto.categoryId,
        dayOfMonth: dto.dayOfMonth,
        intervalMonths: dto.intervalMonths ?? 1,
        active: dto.active ?? true,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { dayOfMonth: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const recurring = await this.prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!recurring) {
      throw new NotFoundException('Recurring transaction not found');
    }
    return recurring;
  }

  async update(userId: string, id: string, dto: UpdateRecurringTransactionDto) {
    await this.findOne(userId, id);
    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }
    return this.prisma.recurringTransaction.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.recurringTransaction.delete({ where: { id } });
  }

  private isDueToday(
    recurring: { dayOfMonth: number; intervalMonths: number; lastRunAt: Date | null },
    today: Date,
  ): boolean {
    if (recurring.dayOfMonth !== today.getDate()) {
      return false;
    }
    if (!recurring.lastRunAt) {
      return true;
    }
    const monthsSinceLastRun =
      (today.getFullYear() - recurring.lastRunAt.getFullYear()) * 12 +
      (today.getMonth() - recurring.lastRunAt.getMonth());
    return monthsSinceLastRun >= recurring.intervalMonths;
  }

  async runDueRecurringTransactions(today: Date = new Date()): Promise<number> {
    const active = await this.prisma.recurringTransaction.findMany({ where: { active: true } });
    const due = active.filter((recurring) => this.isDueToday(recurring, today));

    for (const recurring of due) {
      await this.transactionsService.create(recurring.userId, {
        amount: recurring.amount,
        description: recurring.description,
        categoryId: recurring.categoryId,
        date: today.toISOString(),
      });
      await this.prisma.recurringTransaction.update({
        where: { id: recurring.id },
        data: { lastRunAt: today },
      });
    }

    if (due.length > 0) {
      this.logger.log(`Posted ${due.length} recurring transaction(s) for ${today.toDateString()}`);
    }
    return due.length;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyCron() {
    await this.runDueRecurringTransactions();
  }
}
