import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { update: jest.Mock; findUniqueOrThrow: jest.Mock };
    category: { findFirst: jest.Mock; create: jest.Mock };
    transaction: { create: jest.Mock };
  };
  let transactionsService: { getBalance: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      category: { findFirst: jest.fn(), create: jest.fn() },
      transaction: { create: jest.fn() },
    };
    transactionsService = { getBalance: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransactionsService, useValue: transactionsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('adds the starting balance to the summed transactions', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ startingBalance: 10000 });
      transactionsService.getBalance.mockResolvedValue(-2500);

      const result = await service.getBalance('user-1');

      expect(result).toEqual({ balance: 7500 });
    });
  });

  describe('reconcile', () => {
    it('does nothing and creates no transaction when the actual balance already matches', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ startingBalance: 10000 });
      transactionsService.getBalance.mockResolvedValue(0);

      const result = await service.reconcile('user-1', { actualBalance: 10000 });

      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(result).toEqual({ transaction: null, previousBalance: 10000, actualBalance: 10000, diff: 0 });
    });

    it('books an adjustment transaction for the cent difference, reusing an existing reconciliation category', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ startingBalance: 10000 });
      transactionsService.getBalance.mockResolvedValue(0);
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-reconcile', name: 'Kontoabgleich' });
      prisma.transaction.create.mockResolvedValue({ id: 'tx-1', amount: 250, isReconciliation: true });

      const result = await service.reconcile('user-1', { actualBalance: 10250 });

      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
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
      prisma.user.findUniqueOrThrow.mockResolvedValue({ startingBalance: 0 });
      transactionsService.getBalance.mockResolvedValue(5000);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({ id: 'cat-new', name: 'Kontoabgleich' });
      prisma.transaction.create.mockResolvedValue({ id: 'tx-2' });

      await service.reconcile('user-1', { actualBalance: 4500 });

      expect(prisma.category.create).toHaveBeenCalledWith({ data: { userId: 'user-1', name: 'Kontoabgleich' } });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: 'cat-new', amount: -500 }) }),
      );
    });
  });
});
