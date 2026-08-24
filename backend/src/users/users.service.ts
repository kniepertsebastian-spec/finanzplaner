import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ReconcileBalanceDto } from './dto/reconcile-balance.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const RECONCILIATION_CATEGORY_NAME = 'Kontoabgleich';
const RECONCILIATION_DESCRIPTION = 'Saldo-Abgleich';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    return {
      id: user.id,
      email: user.email,
      totpEnabled: user.totpEnabled,
      monthStartDay: user.monthStartDay,
      startingBalance: user.startingBalance,
    };
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const transactionsSum = await this.transactions.getBalance(userId);
    return { balance: user.startingBalance + transactionsSum };
  }

  private async findOrCreateReconciliationCategory(userId: string) {
    const existing = await this.prisma.category.findFirst({
      where: { userId, name: RECONCILIATION_CATEGORY_NAME },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.category.create({ data: { userId, name: RECONCILIATION_CATEGORY_NAME } });
  }

  // "Saldo abgleichen": user provides the real balance from their bank, we book an automatic
  // adjustment transaction for whatever cent difference remains vs. our own calculated balance —
  // no attempt to guess which real-world booking is missing, just closes the gap.
  async reconcile(userId: string, dto: ReconcileBalanceDto) {
    const { balance: calculatedBalance } = await this.getBalance(userId);
    const diff = dto.actualBalance - calculatedBalance;

    if (diff === 0) {
      return { transaction: null, previousBalance: calculatedBalance, actualBalance: dto.actualBalance, diff };
    }

    const category = await this.findOrCreateReconciliationCategory(userId);
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        categoryId: category.id,
        amount: diff,
        description: RECONCILIATION_DESCRIPTION,
        isReconciliation: true,
      },
    });

    return { transaction, previousBalance: calculatedBalance, actualBalance: dto.actualBalance, diff };
  }
}
