import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SavingsPotsService } from './savings-pots.service';

describe('SavingsPotsService', () => {
  let service: SavingsPotsService;
  let prisma: {
    savingsPot: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      savingsPot: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SavingsPotsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SavingsPotsService>(SavingsPotsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('defaults amountCents to 0 when not provided', async () => {
      await service.create('user-1', { name: 'Notgroschen' });

      expect(prisma.savingsPot.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'Notgroschen', amountCents: 0, targetCents: undefined },
      });
    });

    it('passes through a provided amountCents and targetCents', async () => {
      await service.create('user-1', { name: 'Urlaub', amountCents: 5000, targetCents: 20000 });

      expect(prisma.savingsPot.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'Urlaub', amountCents: 5000, targetCents: 20000 },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the pot does not belong to the user', async () => {
      prisma.savingsPot.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'pot-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('writes the dto straight through to Prisma after an ownership check', async () => {
      prisma.savingsPot.findFirst.mockResolvedValue({ id: 'pot-1', userId: 'user-1' });

      await service.update('user-1', 'pot-1', { amountCents: 7500 });

      expect(prisma.savingsPot.update).toHaveBeenCalledWith({
        where: { id: 'pot-1' },
        data: { amountCents: 7500 },
      });
    });
  });

  describe('remove', () => {
    it('deletes after confirming ownership', async () => {
      prisma.savingsPot.findFirst.mockResolvedValue({ id: 'pot-1', userId: 'user-1' });

      await service.remove('user-1', 'pot-1');

      expect(prisma.savingsPot.delete).toHaveBeenCalledWith({ where: { id: 'pot-1' } });
    });
  });
});
