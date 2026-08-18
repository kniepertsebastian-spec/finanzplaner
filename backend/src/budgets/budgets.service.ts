import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { FindBudgetsQueryDto } from './dto/find-budgets-query.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new ForbiddenException('Category does not belong to the current user');
    }
  }

  async create(userId: string, dto: CreateBudgetDto) {
    await this.assertCategoryOwnership(userId, dto.categoryId);
    return this.prisma.budget.create({
      data: { userId, categoryId: dto.categoryId, amount: dto.amount, month: new Date(dto.month) },
    });
  }

  findAll(userId: string, query: FindBudgetsQueryDto) {
    return this.prisma.budget.findMany({
      where: {
        userId,
        month: query.month ? new Date(query.month) : undefined,
      },
      orderBy: { month: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    return budget;
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    await this.findOne(userId, id);
    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }
    return this.prisma.budget.update({
      where: { id },
      data: {
        amount: dto.amount,
        month: dto.month ? new Date(dto.month) : undefined,
        categoryId: dto.categoryId,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.budget.delete({ where: { id } });
  }
}
