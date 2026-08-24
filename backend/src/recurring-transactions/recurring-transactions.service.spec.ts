import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurringTransactionsService } from './recurring-transactions.service';

describe('RecurringTransactionsService', () => {
  let service: RecurringTransactionsService;
  let prisma: {
    recurringTransaction: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    category: { findFirst: jest.Mock };
  };
  let transactionsService: { create: jest.Mock };

  const today = new Date('2026-08-17T12:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      recurringTransaction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
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

  describe('create', () => {
    it('passes through optional contract metadata and converts contractEndDate to a Date', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', userId: 'user-1' });

      await service.create('user-1', {
        amount: -2999,
        description: 'Internet',
        categoryId: 'cat-1',
        nextDueDate: '2026-09-01',
        contractNumber: 'INET-123',
        contractEndDate: '2027-08-31',
        cancellationPeriodDays: 30,
      });

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractNumber: 'INET-123',
          contractEndDate: new Date('2027-08-31'),
          cancellationPeriodDays: 30,
        }),
      });
    });

    it('leaves contract metadata undefined when not provided', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', userId: 'user-1' });

      await service.create('user-1', {
        amount: -2999,
        description: 'Internet',
        categoryId: 'cat-1',
        nextDueDate: '2026-09-01',
      });

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractNumber: undefined,
          contractEndDate: undefined,
          cancellationPeriodDays: undefined,
        }),
      });
    });
  });

  describe('update', () => {
    it('converts a plain date string nextDueDate into a Date before writing to Prisma', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue({ id: 'rec-1', userId: 'user-1' });

      await service.update('user-1', 'rec-1', { nextDueDate: '2026-09-01' });

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { nextDueDate: new Date('2026-09-01'), contractEndDate: undefined },
      });
    });

    it('leaves nextDueDate/contractEndDate untouched when not part of the update (e.g. pausing a rule)', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue({ id: 'rec-1', userId: 'user-1' });

      await service.update('user-1', 'rec-1', { active: false });

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { active: false, nextDueDate: undefined, contractEndDate: undefined },
      });
    });

    it('converts a plain date string contractEndDate into a Date before writing to Prisma', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue({ id: 'rec-1', userId: 'user-1' });

      await service.update('user-1', 'rec-1', { contractEndDate: '2027-01-31', cancellationPeriodDays: 30 });

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: {
          contractEndDate: new Date('2027-01-31'),
          cancellationPeriodDays: 30,
          nextDueDate: undefined,
        },
      });
    });
  });

  describe('runDueRecurringTransactions', () => {
    it('posts a transaction due today and advances nextDueDate by intervalMonths', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          userId: 'user-1',
          amount: -5000,
          description: 'Miete',
          categoryId: 'cat-1',
          nextDueDate: new Date('2026-08-17T00:00:00.000Z'),
          intervalMonths: 1,
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
        data: { lastRunAt: today, nextDueDate: new Date('2026-09-17T00:00:00.000Z') },
      });
    });

    it('skips a rule whose nextDueDate is still in the future', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-2',
          userId: 'user-1',
          nextDueDate: new Date('2026-08-18T00:00:00.000Z'),
          intervalMonths: 1,
          active: true,
          lastRunAt: null,
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(0);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it('catches up an overdue rule whose nextDueDate is in the past', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-3',
          userId: 'user-1',
          amount: -1000,
          description: 'Verspätet',
          categoryId: 'cat-1',
          nextDueDate: new Date('2026-08-10T00:00:00.000Z'),
          intervalMonths: 1,
          active: true,
          lastRunAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(1);
      expect(transactionsService.create).toHaveBeenCalled();
    });

    it('quarterly rule (GEZ-style): advances nextDueDate by 3 months after firing', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-4',
          userId: 'user-1',
          amount: -5525,
          description: 'GEZ',
          categoryId: 'cat-3',
          nextDueDate: new Date('2026-08-17T00:00:00.000Z'),
          intervalMonths: 3,
          active: true,
          lastRunAt: new Date('2026-05-17T00:00:00.000Z'),
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(1);
      expect(transactionsService.create).toHaveBeenCalledWith('user-1', {
        amount: -5525,
        description: 'GEZ',
        categoryId: 'cat-3',
        date: today.toISOString(),
      });
      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-4' },
        data: { lastRunAt: today, nextDueDate: new Date('2026-11-17T00:00:00.000Z') },
      });
    });

    it('yearly rule anchored in October (car tax) does not fire in August', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-5',
          userId: 'user-1',
          nextDueDate: new Date('2026-10-15T00:00:00.000Z'),
          intervalMonths: 12,
          active: true,
          lastRunAt: null,
        },
      ]);

      const count = await service.runDueRecurringTransactions(today);

      expect(count).toBe(0);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it('yearly rule anchored in October (car tax) fires in October and rolls over to next October', async () => {
      const october = new Date('2026-10-15T12:00:00.000Z');
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-6',
          userId: 'user-1',
          amount: -12000,
          description: 'Kfz-Steuer',
          categoryId: 'cat-4',
          nextDueDate: new Date('2026-10-15T00:00:00.000Z'),
          intervalMonths: 12,
          active: true,
          lastRunAt: null,
        },
      ]);

      const count = await service.runDueRecurringTransactions(october);

      expect(count).toBe(1);
      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-6' },
        data: { lastRunAt: october, nextDueDate: new Date('2027-10-15T00:00:00.000Z') },
      });
    });

    it('clamps month-end overflow when advancing (Jan 31 + 1 month -> Feb 28, not Mar 3)', async () => {
      const jan31 = new Date('2026-01-31T12:00:00.000Z');
      prisma.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rec-7',
          userId: 'user-1',
          amount: -100,
          description: 'Monatsende-Regel',
          categoryId: 'cat-1',
          nextDueDate: new Date('2026-01-31T00:00:00.000Z'),
          intervalMonths: 1,
          active: true,
          lastRunAt: null,
        },
      ]);

      const count = await service.runDueRecurringTransactions(jan31);

      expect(count).toBe(1);
      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-7' },
        data: { lastRunAt: jan31, nextDueDate: new Date('2026-02-28T00:00:00.000Z') },
      });
    });
  });
});
