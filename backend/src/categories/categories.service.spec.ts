import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: { category: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('passes budgetType through when provided', async () => {
      await service.create('user-1', { name: 'Lebensmittel', budgetType: 'NEEDS' });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Lebensmittel', budgetType: 'NEEDS', userId: 'user-1' },
      });
    });

    it('leaves budgetType undefined when not provided', async () => {
      await service.create('user-1', { name: 'Sonstiges' });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Sonstiges', budgetType: undefined, userId: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('writes the dto (including budgetType) straight through after an ownership check', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', userId: 'user-1' });

      await service.update('user-1', 'cat-1', { budgetType: 'WANTS' });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { budgetType: 'WANTS' },
      });
    });
  });
});
