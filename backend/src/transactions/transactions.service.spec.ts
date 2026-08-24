import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: { aggregate: jest.Mock; create: jest.Mock };
    category: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      transaction: { aggregate: jest.fn(), create: jest.fn() },
      category: { findFirst: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CategorizationService, useValue: {} },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('returns the summed transaction amount for the user', async () => {
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 12345 } });

      const balance = await service.getBalance('user-1');

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        _sum: { amount: true },
      });
      expect(balance).toBe(12345);
    });

    it('returns 0 when the user has no transactions yet (sum is null)', async () => {
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const balance = await service.getBalance('user-1');

      expect(balance).toBe(0);
    });
  });

  describe('createSplit', () => {
    it('creates one transaction per split, all sharing a single splitGroupId', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', userId: 'user-1' });
      prisma.transaction.create.mockImplementation((args) => Promise.resolve({ id: 'tx', ...args.data }));

      const results = await service.createSplit('user-1', {
        description: 'Supermarkt',
        date: '2026-08-25',
        splits: [
          { amount: -4500, categoryId: 'cat-lebensmittel' },
          { amount: -1500, categoryId: 'cat-drogerie' },
        ],
      });

      expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = prisma.transaction.create.mock.calls.map((c) => c[0].data);
      expect(firstCall.splitGroupId).toBe(secondCall.splitGroupId);
      expect(firstCall).toMatchObject({
        userId: 'user-1',
        categoryId: 'cat-lebensmittel',
        amount: -4500,
        description: 'Supermarkt',
        date: new Date('2026-08-25'),
      });
      expect(secondCall).toMatchObject({ categoryId: 'cat-drogerie', amount: -1500 });
      expect(results).toHaveLength(2);
    });

    it('rejects when splits mix income and expense signs', async () => {
      await expect(
        service.createSplit('user-1', {
          description: 'Mixed',
          splits: [
            { amount: -4500, categoryId: 'cat-1' },
            { amount: 1500, categoryId: 'cat-2' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('rejects when a split amount is zero', async () => {
      await expect(
        service.createSplit('user-1', {
          description: 'Zero split',
          splits: [
            { amount: 0, categoryId: 'cat-1' },
            { amount: -1500, categoryId: 'cat-2' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a split references a category the user does not own', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.createSplit('user-1', {
          description: 'Supermarkt',
          splits: [
            { amount: -4500, categoryId: 'not-mine' },
            { amount: -1500, categoryId: 'also-not-mine' },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });
});
