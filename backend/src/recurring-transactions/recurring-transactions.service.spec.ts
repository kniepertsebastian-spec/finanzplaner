import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurringTransactionsService } from './recurring-transactions.service';

describe('RecurringTransactionsService', () => {
  let service: RecurringTransactionsService;
  let prisma: {
    recurringTransaction: { findMany: jest.Mock; update: jest.Mock };
  };
  let transactionsService: { create: jest.Mock };

  const today = new Date('2026-08-17T12:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      recurringTransaction: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    transactionsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringTransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransactionsService, useValue: transactionsService },
      ],
    }).compile();

    service = module.get<RecurringTransactionsService>(RecurringTransactionsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('runDueRecurringTransactions', () => {
    it('posts a transaction for a due, never-run recurring rule and stamps lastRunAt', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          userId: 'user-1',
          amount: -5000,
          description: 'Miete',
          categoryId: 'cat-1',
          dayOfMonth: 17,
          active: true,
          lastRunAt: null,
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(1);
      expect(transactionsService.create).toHaveBeenCalledWith('user-1', {
        amount: -5000,
        description: 'Miete',
        categoryId: 'cat-1',
        date: today.toISOString(),
      });
      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { lastRunAt: today },
      });
    });

    it('skips a rule whose dayOfMonth does not match today', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        { id: 'rec-2', userId: 'user-1', dayOfMonth: 1, active: true, lastRunAt: null },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(0);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it('skips a rule already run this month', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-3',
          userId: 'user-1',
          dayOfMonth: 17,
          active: true,
          lastRunAt: new Date('2026-08-17T01:00:00.000Z'),
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(0);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it('re-runs a rule already run in a previous month', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-4',
          userId: 'user-1',
          amount: 250000,
          description: 'Gehalt',
          categoryId: 'cat-2',
          dayOfMonth: 17,
          active: true,
          lastRunAt: new Date('2026-07-17T01:00:00.000Z'),
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(1);
      expect(transactionsService.create).toHaveBeenCalled();
    });
  });
});
