import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';

describe('CategorizationService', () => {
  let service: CategorizationService;
  let prisma: { categoryRule: { findUnique: jest.Mock; upsert: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      categoryRule: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategorizationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategorizationService>(CategorizationService);
  });

  describe('normalize', () => {
    it('trims and lowercases the input', () => {
      expect(service.normalize('  REWE Filiale  ')).toBe('rewe filiale');
    });
  });

  describe('suggestCategoryId', () => {
    it('returns the categoryId of a matching rule', async () => {
      prisma.categoryRule.findUnique.mockResolvedValue({ categoryId: 'cat-1' });

      const result = await service.suggestCategoryId('user-1', ' Netflix ');

      expect(prisma.categoryRule.findUnique).toHaveBeenCalledWith({
        where: { userId_matchText: { userId: 'user-1', matchText: 'netflix' } },
      });
      expect(result).toBe('cat-1');
    });

    it('returns null when no rule matches', async () => {
      prisma.categoryRule.findUnique.mockResolvedValue(null);

      const result = await service.suggestCategoryId('user-1', 'Unknown Payee');

      expect(result).toBeNull();
    });
  });

  describe('learn', () => {
    it('upserts a rule keyed on the normalized description', async () => {
      await service.learn('user-1', ' Netflix ', 'cat-1');

      expect(prisma.categoryRule.upsert).toHaveBeenCalledWith({
        where: { userId_matchText: { userId: 'user-1', matchText: 'netflix' } },
        create: { userId: 'user-1', matchText: 'netflix', categoryId: 'cat-1' },
        update: { categoryId: 'cat-1', useCount: { increment: 1 } },
      });
    });
  });
});
