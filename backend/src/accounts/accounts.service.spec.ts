import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: {
    account: { findFirst: jest.Mock; findMany: jest.Mock };
    category: { findFirst: jest.Mock; create: jest.Mock };
    transaction: { create: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      account: { findFirst: jest.fn(), findMany: jest.fn() },
      category: { findFirst: jest.fn(), create: jest.fn() },
      transaction: { create: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
      // reconcile() runs its work inside `prisma.$transaction(async (tx) => ...)` — the mock just
      // invokes the callback with `prisma` itself, no real transactional isolation needed here.
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalances', () => {
    it('adds each account startingBalance to its own summed transactions', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', userId: 'user-1', name: 'Girokonto', startingBalance: 10000, archived: false },
        { id: 'acc-2', userId: 'user-1', name: 'Sparkonto', startingBalance: 5000, archived: false },
      ]);
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'acc-1', _sum: { amount: -2500 } },
        { accountId: 'acc-2', _sum: { amount: 100 } },
      ]);

      const result = await service.getBalances('user-1');

      expect(result.accounts).toEqual([
        expect.objectContaining({ id: 'acc-1', balanceCents: 7500 }),
        expect.objectContaining({ id: 'acc-2', balanceCents: 5100 }),
      ]);
      expect(result.totalCents).toBe(12600);
    });
  });

  describe('reconcile', () => {
    it('does nothing and creates no transaction when the actual balance already matches', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1', userId: 'user-1', startingBalance: 10000 });
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      const result = await service.reconcile('user-1', 'acc-1', { actualBalance: 10000 });

      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(result).toEqual({ transaction: null, previousBalance: 10000, actualBalance: 10000, diff: 0 });
    });

    it('books an adjustment transaction for the cent difference, reusing an existing reconciliation category', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1', userId: 'user-1', startingBalance: 10000 });
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-reconcile', name: 'Kontoabgleich' });
      prisma.transaction.create.mockResolvedValue({ id: 'tx-1', amount: 250, isReconciliation: true });

      const result = await service.reconcile('user-1', 'acc-1', { actualBalance: 10250 });

      // Category lookup/creation and the adjustment booking must run inside one $transaction — not
      // as two independent queries that could leave a category with no matching booking if the
      // connection drops in between.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          accountId: 'acc-1',
          categoryId: 'cat-reconcile',
          amount: 250,
          description: 'Saldo-Abgleich',
          isReconciliation: true,
        },
      });
      expect(result.diff).toBe(250);
      expect(result.previousBalance).toBe(10000);
      expect(result.transaction).toEqual({ id: 'tx-1', amount: 250, isReconciliation: true });
    });

    it('creates the reconciliation category on first use if it does not exist yet', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1', userId: 'user-1', startingBalance: 0 });
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({ id: 'cat-new', name: 'Kontoabgleich' });
      prisma.transaction.create.mockResolvedValue({ id: 'tx-2' });

      await service.reconcile('user-1', 'acc-1', { actualBalance: 4500 });

      expect(prisma.category.create).toHaveBeenCalledWith({ data: { userId: 'user-1', name: 'Kontoabgleich' } });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: 'cat-new', amount: -500 }) }),
      );
    });

    it('throws NotFoundException when the account does not belong to the user', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.reconcile('user-1', 'acc-not-mine', { actualBalance: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
