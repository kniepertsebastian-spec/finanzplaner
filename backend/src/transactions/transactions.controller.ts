import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BulkRemoveTransactionsDto } from './dto/bulk-remove-transactions.dto';
import { BulkUpdateTransactionsDto } from './dto/bulk-update-transactions.dto';
import { CreateTransactionSplitDto } from './dto/create-transaction-split.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FindTransactionsQueryDto } from './dto/find-transactions-query.dto';
import { TaxExportQueryDto } from './dto/tax-export-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.id, dto);
  }

  @Post('split')
  createSplit(@CurrentUser() user: { id: string }, @Body() dto: CreateTransactionSplitDto) {
    return this.transactionsService.createSplit(user.id, dto);
  }

  @Post('transfer')
  createTransfer(@CurrentUser() user: { id: string }, @Body() dto: CreateTransferDto) {
    return this.transactionsService.createTransfer(user.id, dto);
  }

  // POST rather than DELETE/PATCH with an id list in the body, so these stay unambiguous literal
  // routes and never risk colliding with the ':id' routes below (e.g. a PATCH to '/bulk' matching
  // the ':id' pattern with id='bulk' if route registration order ever changed).
  @Post('bulk-delete')
  bulkRemove(@CurrentUser() user: { id: string }, @Body() dto: BulkRemoveTransactionsDto) {
    return this.transactionsService.bulkRemove(user.id, dto);
  }

  @Post('bulk-update')
  bulkUpdate(@CurrentUser() user: { id: string }, @Body() dto: BulkUpdateTransactionsDto) {
    return this.transactionsService.bulkUpdate(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }, @Query() query: FindTransactionsQueryDto) {
    return this.transactionsService.findAll(user.id, query);
  }

  // Literal route, registered before ':id' for the same reason as the bulk POST routes above.
  @Get('tax-export')
  taxExport(
    @CurrentUser() user: { id: string },
    @Query() query: TaxExportQueryDto,
    @Res() res: Response,
  ) {
    return this.transactionsService.streamTaxExport(user.id, query.year, res);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.transactionsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.transactionsService.remove(user.id, id);
  }
}
