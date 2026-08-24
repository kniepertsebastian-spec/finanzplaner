import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: { transaction: { aggregate: jest.Mock } };

  beforeEach(async () => {
    prisma = { transaction: { aggregate: jest.fn() } };

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
});
