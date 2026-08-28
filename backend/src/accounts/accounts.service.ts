import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ReconcileBalanceDto } from './dto/reconcile-balance.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

const RECONCILIATION_CATEGORY_NAME = 'Kontoabgleich';
const RECONCILIATION_DESCRIPTION = 'Saldo-Abgleich';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        name: dto.name,
        type: dto.type,
        startingBalance: dto.startingBalance ?? 0,
        userId,
      },
    });
  }

  findAll(userId: string, includeArchived: boolean) {
    return this.prisma.account.findMany({
      where: includeArchived ? { userId } : { userId, archived: false },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(userId, id);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    // No explicit "has transactions" check here — Transaction.accountId is a required FK with
    // ON DELETE RESTRICT, so Postgres itself rejects deleting an account still in use. Archiving
    // (via update) is the intended way to retire an account that has history.
    await this.prisma.account.delete({ where: { id } });
  }

  // Each account's live balance = its own startingBalance + every transaction ever posted to it
  // (transfer legs included — they move real money between accounts even though they're excluded
  // from income/expense totals elsewhere). `total` is Gesamtsaldo across all non-archived accounts.
  async getBalances(userId: string) {
    const accounts = await this.findAll(userId, false);
    const sums = await this.prisma.transaction.groupBy({
      by: ['accountId'],
      where: { userId, accountId: { in: accounts.map((a) => a.id) } },
      _sum: { amount: true },
    });
    const sumByAccountId = new Map(sums.map((s) => [s.accountId, s._sum.amount ?? 0]));

    const results = accounts.map((account) => ({
      ...account,
      balanceCents: account.startingBalance + (sumByAccountId.get(account.id) ?? 0),
    }));
    const totalCents = results.reduce((sum, a) => sum + a.balanceCents, 0);
    return { accounts: results, totalCents };
  }

  private async getSingleBalance(accountId: string, account: { startingBalance: number }) {
    const result = await this.prisma.transaction.aggregate({
      where: { accountId },
      _sum: { amount: true },
    });
    return account.startingBalance + (result._sum.amount ?? 0);
  }

  // "Saldo abgleichen" for one account: the user provides the real balance from their bank, we
  // book an automatic adjustment transaction for whatever cent difference remains vs. our own
  // calculated balance for that account — no attempt to guess which real-world booking is
  // missing, just closes the gap. Same category find-or-create + single-$transaction pattern as
  // TransactionsService.createTransfer(), for the same reason (no orphaned category on a dropped
  // connection).
  async reconcile(userId: string, accountId: string, dto: ReconcileBalanceDto) {
    const account = await this.findOne(userId, accountId);
    const calculatedBalance = await this.getSingleBalance(accountId, account);
    const diff = dto.actualBalance - calculatedBalance;

    if (diff === 0) {
      return { transaction: null, previousBalance: calculatedBalance, actualBalance: dto.actualBalance, diff };
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      const category =
        (await tx.category.findFirst({ where: { userId, name: RECONCILIATION_CATEGORY_NAME } })) ??
        (await tx.category.create({ data: { userId, name: RECONCILIATION_CATEGORY_NAME } }));

      return tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: category.id,
          amount: diff,
          description: RECONCILIATION_DESCRIPTION,
          isReconciliation: true,
        },
      });
    });

    return { transaction, previousBalance: calculatedBalance, actualBalance: dto.actualBalance, diff };
  }
}
