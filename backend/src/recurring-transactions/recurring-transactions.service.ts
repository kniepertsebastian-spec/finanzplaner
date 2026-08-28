import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { pingHeartbeat } from '../common/heartbeat.util';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { currentPeriodEndUTC } from './financial-period';

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

  private async assertAccountOwnership(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new ForbiddenException('Account does not belong to the current user');
    }
  }

  async create(userId: string, dto: CreateRecurringTransactionDto) {
    await this.assertCategoryOwnership(userId, dto.categoryId);
    await this.assertAccountOwnership(userId, dto.accountId);
    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        amount: dto.amount,
        description: dto.description,
        categoryId: dto.categoryId,
        accountId: dto.accountId,
        nextDueDate: new Date(dto.nextDueDate),
        intervalMonths: dto.intervalMonths ?? 1,
        active: dto.active ?? true,
        avoidable: dto.avoidable ?? false,
        inefficient: dto.inefficient ?? false,
        tooExpensive: dto.tooExpensive ?? false,
        contractNumber: dto.contractNumber,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
        cancellationPeriodDays: dto.cancellationPeriodDays,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { nextDueDate: 'asc' },
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
    const existing = await this.findOne(userId, id);
    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }
    if (dto.accountId) {
      await this.assertAccountOwnership(userId, dto.accountId);
    }
    const amountChanged = dto.amount !== undefined && dto.amount !== existing.amount;
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...dto,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
        previousAmount: amountChanged ? existing.amount : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.recurringTransaction.delete({ where: { id } });
  }

  async dismissPriceIncrease(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.recurringTransaction.update({ where: { id }, data: { previousAmount: null } });
  }

  private static dateOnly(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  // A rule is due as soon as its due date falls anywhere within the owning user's *current*
  // financial period — not only once the literal calendar day arrives. This posts a period's
  // fixed costs all at once at the start of the cycle (so the dashboard reflects the full
  // month's costs from day one) rather than drip-feeding them in as each due date passes; the
  // user reviews/edits/deletes individual postings by hand if a bill turns out different.
  private isDue(recurring: { nextDueDate: Date; user: { monthStartDay: number } }, today: Date): boolean {
    const periodEndUTC = currentPeriodEndUTC(recurring.user.monthStartDay, today);
    return RecurringTransactionsService.dateOnly(recurring.nextDueDate) <= periodEndUTC;
  }

  /** Advances a date by N months, clamping day overflow to the last day of the target month
   *  (e.g. Jan 31 + 1 month -> Feb 28/29, not Mar 3), so a monthly/yearly rule anchored on a
   *  short month doesn't drift into the following month over time. */
  private static addMonths(date: Date, months: number): Date {
    const day = date.getUTCDate();
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + months);
    if (next.getUTCDate() !== day) {
      next.setUTCDate(0);
    }
    return next;
  }

  async runDueRecurringTransactions(today: Date = new Date()): Promise<number> {
    const active = await this.prisma.recurringTransaction.findMany({
      where: { active: true },
      include: { user: { select: { monthStartDay: true } } },
    });
    const due = active.filter((recurring) => this.isDue(recurring, today));

    for (const recurring of due) {
      await this.transactionsService.create(recurring.userId, {
        amount: recurring.amount,
        description: recurring.description,
        categoryId: recurring.categoryId,
        accountId: recurring.accountId,
        date: today.toISOString(),
      });
      await this.prisma.recurringTransaction.update({
        where: { id: recurring.id },
        data: {
          lastRunAt: today,
          nextDueDate: RecurringTransactionsService.addMonths(recurring.nextDueDate, recurring.intervalMonths),
        },
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
    await pingHeartbeat(process.env.RECURRING_TRANSACTIONS_HEARTBEAT_URL, 'recurring-transactions daily cron');
  }
}
