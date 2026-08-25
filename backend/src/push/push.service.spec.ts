import { Test, TestingModule } from '@nestjs/testing';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
  WebPushError: class WebPushError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

describe('PushService', () => {
  let service: PushService;
  let prisma: {
    pushSubscription: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock; delete: jest.Mock };
    user: { findMany: jest.Mock };
    budget: { findMany: jest.Mock };
    transaction: { aggregate: jest.Mock };
    recurringTransaction: { findMany: jest.Mock };
  };
  const originalEnv = process.env;

  const buildService = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PushService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return module.get<PushService>(PushService);
  };

  beforeEach(() => {
    prisma = {
      pushSubscription: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
      user: { findMany: jest.fn() },
      budget: { findMany: jest.fn() },
      transaction: { aggregate: jest.fn() },
      recurringTransaction: { findMany: jest.fn() },
    };
    process.env = { ...originalEnv, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reports no public key when VAPID env vars are unset (feature disabled)', async () => {
    process.env = { ...originalEnv, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' };
    service = await buildService();

    expect(service.getPublicKey()).toBeNull();
  });

  it('reports the public key when configured', async () => {
    service = await buildService();
    expect(service.getPublicKey()).toBe('pub');
  });

  describe('subscribe/unsubscribe', () => {
    beforeEach(async () => {
      service = await buildService();
    });

    it('upserts a subscription by endpoint', async () => {
      await service.subscribe('user-1', { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } });

      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example/abc' },
        create: { userId: 'user-1', endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' },
        update: { userId: 'user-1', p256dh: 'p', auth: 'a' },
      });
    });

    it('removes a subscription scoped to the current user', async () => {
      await service.unsubscribe('user-1', 'https://push.example/abc');

      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example/abc', userId: 'user-1' },
      });
    });
  });

  describe('checkBudgetOverruns', () => {
    beforeEach(async () => {
      service = await buildService();
    });

    it('sends a push when spending exceeds a budget in the current period', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', monthStartDay: 1 }]);
      prisma.budget.findMany.mockResolvedValue([
        { id: 'b1', amount: 10000, categoryId: 'cat-1', category: { name: 'Lebensmittel' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: -15000 } });
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' },
      ]);

      await service.checkBudgetOverruns(new Date('2026-08-15'));

      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
      const [, payload] = (webpush.sendNotification as jest.Mock).mock.calls[0];
      expect(JSON.parse(payload)).toEqual({
        title: 'Budget überschritten',
        body: 'Über dem Budget: Lebensmittel',
      });
    });

    it('does not send a push when spending stays within budget', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', monthStartDay: 1 }]);
      prisma.budget.findMany.mockResolvedValue([
        { id: 'b1', amount: 10000, categoryId: 'cat-1', category: { name: 'Lebensmittel' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: -5000 } });

      await service.checkBudgetOverruns(new Date('2026-08-15'));

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('skips users with no budgets in the current period without querying transactions', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', monthStartDay: 1 }]);
      prisma.budget.findMany.mockResolvedValue([]);

      await service.checkBudgetOverruns(new Date('2026-08-15'));

      expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('is a no-op when push is not configured', async () => {
      process.env = { ...originalEnv, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' };
      service = await buildService();

      await service.checkBudgetOverruns(new Date('2026-08-15'));

      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('checkUpcomingLargeTransactions', () => {
    beforeEach(async () => {
      service = await buildService();
    });

    it('notifies once per user, listing all large upcoming recurring transactions', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        { userId: 'user-1', amount: -95000, description: 'Miete' },
        { userId: 'user-1', amount: -5000, description: 'Streaming' }, // below threshold, excluded
        { userId: 'user-2', amount: -30000, description: 'KFZ-Versicherung' },
      ]);
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' },
      ]);

      await service.checkUpcomingLargeTransactions(new Date('2026-08-15'));

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      const bodies = (webpush.sendNotification as jest.Mock).mock.calls.map(([, p]) => JSON.parse(p).body);
      expect(bodies.some((b: string) => b.includes('Miete') && !b.includes('Streaming'))).toBe(true);
      expect(bodies.some((b: string) => b.includes('KFZ-Versicherung'))).toBe(true);
    });

    it('sends nothing when no upcoming transaction meets the threshold', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([{ userId: 'user-1', amount: -1000, description: 'Kaffee' }]);

      await service.checkUpcomingLargeTransactions(new Date('2026-08-15'));

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendToUser (via checkBudgetOverruns) — dead subscription cleanup', () => {
    it('deletes a subscription that comes back as expired (410)', async () => {
      service = await buildService();
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', monthStartDay: 1 }]);
      prisma.budget.findMany.mockResolvedValue([
        { id: 'b1', amount: 100, categoryId: 'cat-1', category: { name: 'Test' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: -1000 } });
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' },
      ]);
      prisma.pushSubscription.delete.mockResolvedValue({});
      (webpush.sendNotification as jest.Mock).mockRejectedValue(
        new webpush.WebPushError('gone', 410, {}, '', 'https://push.example/1'),
      );

      await service.checkBudgetOverruns(new Date('2026-08-15'));

      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
    });
  });
});
