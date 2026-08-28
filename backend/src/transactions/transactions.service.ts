import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
// `import archiver from 'archiver'` compiles under allowSyntheticDefaultImports but resolves to
// `.default` at runtime, which archiver's actual CommonJS export doesn't have — this
// require-style import matches the module's real CJS shape (module.exports = archiver fn).
import archiver = require('archiver');
import { UPLOADS_DIR } from '../invoices/invoices.multer-options';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { csvEscape } from './csv-escape';
import { BulkRemoveTransactionsDto } from './dto/bulk-remove-transactions.dto';
import { BulkUpdateTransactionsDto } from './dto/bulk-update-transactions.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransactionSplitDto } from './dto/create-transaction-split.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FindTransactionsQueryDto } from './dto/find-transactions-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { normalizeTags } from './normalize-tags';

const TRANSFER_CATEGORY_NAME = 'Umbuchung';
const TRANSFER_DEFAULT_DESCRIPTION = 'Umbuchung';

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

  private async assertAccountOwnership(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new ForbiddenException('Account does not belong to the current user');
    }
  }

  // Falls back to the user's oldest non-archived account when none is given, so a single-account
  // user (the common case) never has to pick one explicitly.
  private async resolveAccountId(userId: string, accountId: string | undefined): Promise<string> {
    if (accountId) {
      await this.assertAccountOwnership(userId, accountId);
      return accountId;
    }
    const defaultAccount = await this.prisma.account.findFirst({
      where: { userId, archived: false },
      orderBy: { createdAt: 'asc' },
    });
    if (!defaultAccount) {
      throw new BadRequestException('accountId is required (no account exists yet for this user)');
    }
    return defaultAccount.id;
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
    const accountId = await this.resolveAccountId(userId, dto.accountId);
    return this.prisma.transaction.create({
      data: {
        userId,
        categoryId,
        accountId,
        amount: dto.amount,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        avoidable: dto.avoidable,
        inefficient: dto.inefficient,
        tooExpensive: dto.tooExpensive,
        taxRelevant: dto.taxRelevant,
        tags: dto.tags ? normalizeTags(dto.tags) : undefined,
      },
    });
  }

  // Creates 2+ sibling transactions sharing one splitGroupId (e.g. a single 60 EUR supermarket
  // receipt split into 45 EUR Lebensmittel + 15 EUR Drogerie). Each split keeps its own amount and
  // category but shares the description/date — they're ordinary, independently editable
  // transactions afterwards, grouped only by splitGroupId for display purposes.
  async createSplit(userId: string, dto: CreateTransactionSplitDto) {
    const signs = new Set(dto.splits.map((s) => Math.sign(s.amount)));
    if (signs.has(0) || signs.size > 1) {
      throw new BadRequestException('All splits must be non-zero and share the same sign (all income or all expense)');
    }
    for (const split of dto.splits) {
      await this.assertCategoryOwnership(userId, split.categoryId);
    }
    const accountId = await this.resolveAccountId(userId, dto.accountId);

    const splitGroupId = randomUUID();
    const date = dto.date ? new Date(dto.date) : undefined;
    return this.prisma.$transaction(
      dto.splits.map((split) =>
        this.prisma.transaction.create({
          data: {
            userId,
            categoryId: split.categoryId,
            accountId,
            amount: split.amount,
            description: dto.description,
            date,
            splitGroupId,
          },
        }),
      ),
    );
  }

  // "Umbuchung": moves money between two of the user's own accounts. Booked as a linked pair of
  // ordinary transactions (negative leg in fromAccount, positive leg in toAccount) sharing one
  // transferGroupId, both flagged isTransfer so income/expense aggregations everywhere else skip
  // them — this isn't real income or spending, just money changing which account it sits in.
  // Category find-or-create + both transaction creates run in one $transaction, same pattern as
  // UsersService.reconcile(), so a dropped connection can't leave one leg posted without the other.
  async createTransfer(userId: string, dto: CreateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('fromAccountId and toAccountId must be different accounts');
    }
    await this.assertAccountOwnership(userId, dto.fromAccountId);
    await this.assertAccountOwnership(userId, dto.toAccountId);

    const transferGroupId = randomUUID();
    const date = dto.date ? new Date(dto.date) : undefined;
    const description = dto.description ?? TRANSFER_DEFAULT_DESCRIPTION;

    const [outgoing, incoming] = await this.prisma.$transaction(async (tx) => {
      const category =
        (await tx.category.findFirst({ where: { userId, name: TRANSFER_CATEGORY_NAME } })) ??
        (await tx.category.create({ data: { userId, name: TRANSFER_CATEGORY_NAME } }));

      const outgoingLeg = await tx.transaction.create({
        data: {
          userId,
          categoryId: category.id,
          accountId: dto.fromAccountId,
          amount: -dto.amount,
          description,
          date,
          isTransfer: true,
          transferGroupId,
        },
      });
      const incomingLeg = await tx.transaction.create({
        data: {
          userId,
          categoryId: category.id,
          accountId: dto.toAccountId,
          amount: dto.amount,
          description,
          date,
          isTransfer: true,
          transferGroupId,
        },
      });
      return [outgoingLeg, incomingLeg];
    });

    return { outgoing, incoming };
  }

  findAll(userId: string, query: FindTransactionsQueryDto) {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: query.categoryId,
        accountId: query.accountId,
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

    let accountId = existing.accountId;
    if (dto.accountId) {
      await this.assertAccountOwnership(userId, dto.accountId);
      accountId = dto.accountId;
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        amount: dto.amount,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        categoryId,
        accountId,
        avoidable: dto.avoidable,
        inefficient: dto.inefficient,
        tooExpensive: dto.tooExpensive,
        taxRelevant: dto.taxRelevant,
        tags: dto.tags ? normalizeTags(dto.tags) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
  }

  // Scoped by userId in the `where` clause (not just the id list) so a stray id from another user
  // can never be deleted/edited — Prisma's *Many operations silently skip non-matching rows rather
  // than throwing, which is the right behavior here (no need to fail the whole batch over one id
  // that no longer exists, e.g. deleted concurrently in another tab).
  async bulkRemove(userId: string, dto: BulkRemoveTransactionsDto) {
    const result = await this.prisma.transaction.deleteMany({
      where: { id: { in: dto.ids }, userId },
    });
    return { count: result.count };
  }

  async bulkUpdate(userId: string, dto: BulkUpdateTransactionsDto) {
    if (dto.patch.categoryId) {
      await this.assertCategoryOwnership(userId, dto.patch.categoryId);
    }
    if (dto.patch.accountId) {
      await this.assertAccountOwnership(userId, dto.patch.accountId);
    }
    const result = await this.prisma.transaction.updateMany({
      where: { id: { in: dto.ids }, userId },
      data: {
        categoryId: dto.patch.categoryId,
        accountId: dto.patch.accountId,
        avoidable: dto.patch.avoidable,
        inefficient: dto.patch.inefficient,
        tooExpensive: dto.patch.tooExpensive,
        taxRelevant: dto.patch.taxRelevant,
      },
    });
    return { count: result.count };
  }

  // Bundles every tax-relevant transaction of the given year (CSV) together with whatever invoices
  // were uploaded in that same year (PDF/JPEG/PNG receipts) into one ZIP for handing to a
  // Steuerberater. Note: invoices auto-delete after 30 days unless marked "Wichtig" (see
  // InvoicesService.deleteExpired) — this export can only bundle what still exists on disk, so
  // receipts meant for a tax filing should be marked important when uploaded.
  async streamTaxExport(userId: string, year: number, res: Response): Promise<void> {
    const rangeStart = new Date(Date.UTC(year, 0, 1));
    const rangeEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [transactions, invoices] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, taxRelevant: true, isTransfer: false, date: { gte: rangeStart, lt: rangeEnd } },
        include: { category: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.invoice.findMany({
        where: { userId, uploadedAt: { gte: rangeStart, lt: rangeEnd } },
        orderBy: { uploadedAt: 'asc' },
      }),
    ]);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Steuerexport-${year}.zip"`,
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const csvLines = [
      ['Datum', 'Beschreibung', 'Kategorie', 'Betrag (EUR)', 'Tags'].join(';'),
      ...transactions.map((t) =>
        [
          t.date.toISOString().slice(0, 10),
          csvEscape(t.description),
          csvEscape(t.category.name),
          (t.amount / 100).toFixed(2).replace('.', ','),
          csvEscape(t.tags.join(', ')),
        ].join(';'),
      ),
    ];
    archive.append(csvLines.join('\n'), { name: 'steuerrelevante-buchungen.csv' });

    for (const invoice of invoices) {
      const filePath = path.join(UPLOADS_DIR, invoice.storagePath);
      if (!existsSync(filePath)) continue; // e.g. auto-deleted since upload; skip rather than fail the whole export
      const datePrefix = invoice.uploadedAt.toISOString().slice(0, 10);
      archive.file(filePath, { name: `belege/${datePrefix}_${invoice.filename}` });
    }

    await archive.finalize();
  }
}
