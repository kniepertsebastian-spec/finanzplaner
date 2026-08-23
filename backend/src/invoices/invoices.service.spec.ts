import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

jest.mock('node:fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: {
    invoice: { findMany: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoicesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('deleteExpired', () => {
    const RETENTION_DAYS = 30;
    const now = new Date('2026-09-01T00:00:00.000Z');
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    it('queries only invoices older than the retention cutoff that are not flagged important', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.deleteExpired(now);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { important: false, uploadedAt: { lt: cutoff } },
      });
    });

    it('deletes each expired invoice row and returns the count', async () => {
      const expired = [
        { id: 'inv-1', storagePath: 'a.pdf', important: false, uploadedAt: new Date('2026-07-01T00:00:00.000Z') },
        { id: 'inv-2', storagePath: 'b.pdf', important: false, uploadedAt: new Date('2026-07-15T00:00:00.000Z') },
      ];
      prisma.invoice.findMany.mockResolvedValue(expired);
      prisma.invoice.delete.mockResolvedValue({});

      const count = await service.deleteExpired(now);

      expect(count).toBe(2);
      expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
      expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-2' } });
    });

    it('deletes nothing when there are no expired, non-important invoices', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      const count = await service.deleteExpired(now);

      expect(count).toBe(0);
      expect(prisma.invoice.delete).not.toHaveBeenCalled();
    });
  });
});
