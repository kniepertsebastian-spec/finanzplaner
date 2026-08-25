import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as webpush from 'web-push';
import { currentPeriodEndUTC, currentPeriodStartUTC } from '../recurring-transactions/financial-period';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';

// Fixed, not user-configurable — keeps the settings surface small. "Large" is relative to typical
// household bills (rent, insurance premiums), not a personalized/learned threshold.
const LARGE_TRANSACTION_THRESHOLD_CENTS = 20000; // 200 EUR
const UPCOMING_WINDOW_DAYS = 3;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;
  private readonly publicKey?: string;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    this.configured = Boolean(publicKey && privateKey);
    this.publicKey = publicKey;
    if (this.configured) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', publicKey!, privateKey!);
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications are disabled.');
    }
  }

  getPublicKey(): string | null {
    return this.configured ? (this.publicKey ?? null) : null;
  }

  async subscribe(userId: string, dto: SubscribePushDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }

  private async sendToUser(userId: string, payload: { title: string; body: string }): Promise<void> {
    if (!this.configured) return;
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = err instanceof webpush.WebPushError ? err.statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          // Browser revoked or expired this subscription — clean it up instead of retrying forever.
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          this.logger.error(`Push to user ${userId} failed: ${err}`);
        }
      }
    }
  }

  async checkBudgetOverruns(today: Date = new Date()): Promise<void> {
    if (!this.configured) return;
    const users = await this.prisma.user.findMany({ select: { id: true, monthStartDay: true } });

    for (const user of users) {
      const periodStart = new Date(currentPeriodStartUTC(user.monthStartDay, today));
      const periodEnd = new Date(currentPeriodEndUTC(user.monthStartDay, today));
      const budgets = await this.prisma.budget.findMany({
        where: { userId: user.id, month: periodStart },
        include: { category: true },
      });
      if (budgets.length === 0) continue;

      const overrunCategoryNames: string[] = [];
      for (const budget of budgets) {
        const spent = await this.prisma.transaction.aggregate({
          where: {
            userId: user.id,
            categoryId: budget.categoryId,
            amount: { lt: 0 },
            date: { gte: periodStart, lte: periodEnd },
          },
          _sum: { amount: true },
        });
        if (Math.abs(spent._sum.amount ?? 0) > budget.amount) {
          overrunCategoryNames.push(budget.category.name);
        }
      }

      if (overrunCategoryNames.length > 0) {
        await this.sendToUser(user.id, {
          title: 'Budget überschritten',
          body: `Über dem Budget: ${overrunCategoryNames.join(', ')}`,
        });
      }
    }
  }

  async checkUpcomingLargeTransactions(today: Date = new Date()): Promise<void> {
    if (!this.configured) return;
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + UPCOMING_WINDOW_DAYS);

    const upcoming = await this.prisma.recurringTransaction.findMany({
      where: { active: true, nextDueDate: { gte: today, lte: windowEnd } },
    });

    const largeByUser = new Map<string, string[]>();
    for (const recurring of upcoming) {
      if (Math.abs(recurring.amount) < LARGE_TRANSACTION_THRESHOLD_CENTS) continue;
      const descriptions = largeByUser.get(recurring.userId) ?? [];
      descriptions.push(recurring.description);
      largeByUser.set(recurring.userId, descriptions);
    }

    for (const [userId, descriptions] of largeByUser) {
      await this.sendToUser(userId, {
        title: 'Anstehende Großbuchung(en)',
        body: `In den nächsten ${UPCOMING_WINDOW_DAYS} Tagen fällig: ${descriptions.join(', ')}`,
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailyChecks(): Promise<void> {
    await this.checkBudgetOverruns();
    await this.checkUpcomingLargeTransactions();
  }
}
