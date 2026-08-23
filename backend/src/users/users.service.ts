import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    return { id: user.id, email: user.email, totpEnabled: user.totpEnabled, monthStartDay: user.monthStartDay };
  }
}
