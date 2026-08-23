import { unlink } from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UPLOADS_DIR } from './invoices.multer-options';

const RETENTION_DAYS = 30;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, file: Express.Multer.File) {
    return this.prisma.invoice.create({
      data: {
        userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.filename,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.invoice.findMany({ where: { userId }, orderBy: { uploadedAt: 'desc' } });
  }

  async findOne(userId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, userId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    await this.findOne(userId, id);
    return this.prisma.invoice.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const invoice = await this.findOne(userId, id);
    await this.prisma.invoice.delete({ where: { id: invoice.id } });
    await unlink(path.join(UPLOADS_DIR, invoice.storagePath)).catch(() => {
      // Row is gone either way — a missing file on disk shouldn't surface as a user-facing error.
    });
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.invoice.findMany({
      where: { important: false, uploadedAt: { lt: cutoff } },
    });

    for (const invoice of expired) {
      await this.prisma.invoice.delete({ where: { id: invoice.id } });
      await unlink(path.join(UPLOADS_DIR, invoice.storagePath)).catch(() => {});
    }

    if (expired.length > 0) {
      this.logger.log(`Deleted ${expired.length} expired invoice(s) older than ${RETENTION_DAYS} days.`);
    }
    return expired.length;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyCleanup() {
    await this.deleteExpired();
  }
}
