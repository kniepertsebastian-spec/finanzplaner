import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: { aggregate: jest.Mock; create: jest.Mock; deleteMany: jest.Mock; updateMany: jest.Mock };
    category: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  let categorization: { learn: jest.Mock; suggestCategoryId: jest.Mock };

  beforeEach(async () => {
    prisma = {
      transaction: { aggregate: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() },
      category: { findFirst: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    categorization = { learn: jest.fn(), suggestCategoryId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CategorizationService, useValue: categorization },
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

  describe('create', () => {
    it('normalizes tags before storing (strips #, trims, dedupes)', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', userId: 'user-1' });
      prisma.transaction.create.mockImplementation((args) => Promise.resolve({ id: 'tx', ...args.data }));

      await service.create('user-1', {
        amount: -1500,
        description: 'Hotel',
        categoryId: 'cat-1',
        tags: ['#Urlaub2026', '  urlaub2026 ', 'Renovierung'],
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tags: ['Urlaub2026', 'Renovierung'] }) }),
      );
    });

    it('leaves tags undefined (schema default) when none are given', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', userId: 'user-1' });
      prisma.transaction.create.mockImplementation((args) => Promise.resolve({ id: 'tx', ...args.data }));

      await service.create('user-1', { amount: -1500, description: 'Hotel', categoryId: 'cat-1' });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tags: undefined }) }),
      );
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

  describe('bulkRemove', () => {
    it('deletes only the given ids scoped to the current user', async () => {
      prisma.transaction.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkRemove('user-1', { ids: ['tx-1', 'tx-2'] });

      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-1', 'tx-2'] }, userId: 'user-1' },
      });
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('bulkUpdate', () => {
    it('applies the patch to all given ids scoped to the current user', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkUpdate('user-1', {
        ids: ['tx-1', 'tx-2', 'tx-3'],
        patch: { avoidable: true },
      });

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-1', 'tx-2', 'tx-3'] }, userId: 'user-1' },
        data: { categoryId: undefined, avoidable: true, inefficient: undefined, tooExpensive: undefined },
      });
      expect(result).toEqual({ count: 3 });
    });

    it('rejects when the patch references a category the user does not own', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkUpdate('user-1', { ids: ['tx-1'], patch: { categoryId: 'not-mine' } }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    });
  });
});
