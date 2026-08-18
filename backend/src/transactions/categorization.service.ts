import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategorizationService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(text: string): string {
    return text.trim().toLowerCase();
  }

  async suggestCategoryId(userId: string, description: string): Promise<string | null> {
    const rule = await this.prisma.categoryRule.findUnique({
      where: { userId_matchText: { userId, matchText: this.normalize(description) } },
    });
    return rule?.categoryId ?? null;
  }

  async learn(userId: string, description: string, categoryId: string): Promise<void> {
    const matchText = this.normalize(description);
    await this.prisma.categoryRule.upsert({
      where: { userId_matchText: { userId, matchText } },
      create: { userId, matchText, categoryId },
      update: { categoryId, useCount: { increment: 1 } },
    });
  }
}
