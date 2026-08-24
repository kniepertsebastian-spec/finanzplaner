import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsPotDto } from './dto/create-savings-pot.dto';
import { UpdateSavingsPotDto } from './dto/update-savings-pot.dto';

@Injectable()
export class SavingsPotsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateSavingsPotDto) {
    return this.prisma.savingsPot.create({
      data: {
        userId,
        name: dto.name,
        amountCents: dto.amountCents ?? 0,
        targetCents: dto.targetCents,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.savingsPot.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const pot = await this.prisma.savingsPot.findFirst({ where: { id, userId } });
    if (!pot) {
      throw new NotFoundException('Savings pot not found');
    }
    return pot;
  }

  async update(userId: string, id: string, dto: UpdateSavingsPotDto) {
    await this.findOne(userId, id);
    return this.prisma.savingsPot.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.savingsPot.delete({ where: { id } });
  }
}
