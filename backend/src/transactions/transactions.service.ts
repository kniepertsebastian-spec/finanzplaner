import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FindTransactionsQueryDto } from './dto/find-transactions-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categorization: CategorizationService,
  ) {}

  private async assertCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new ForbiddenException('Category does not belong to the current user');
    }
  }

  private async resolveCategoryId(
    userId: string,
    description: string,
    categoryId: string | undefined,
  ): Promise<string> {
    if (categoryId) {
      await this.assertCategoryOwnership(userId, categoryId);
      await this.categorization.learn(userId, description, categoryId);
      return categoryId;
    }

    const suggested = await this.categorization.suggestCategoryId(userId, description);
    if (!suggested) {
      throw new BadRequestException(
        'categoryId is required (no matching category rule learned yet for this description)',
      );
    }
    return suggested;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const categoryId = await this.resolveCategoryId(userId, dto.description, dto.categoryId);
    return this.prisma.transaction.create({
      data: {
        userId,
        categoryId,
        amount: dto.amount,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  findAll(userId: string, query: FindTransactionsQueryDto) {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: query.categoryId,
        date: {
          gte: query.startDate ? new Date(query.startDate) : undefined,
          lte: query.endDate ? new Date(query.endDate) : undefined,
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(userId, id);

    let categoryId = existing.categoryId;
    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
      categoryId = dto.categoryId;
      await this.categorization.learn(userId, dto.description ?? existing.description, categoryId);
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        amount: dto.amount,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        categoryId,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
  }
}
