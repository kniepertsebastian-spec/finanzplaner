import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ReconcileBalanceDto } from './dto/reconcile-balance.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }, @Query('includeArchived') includeArchived?: string) {
    return this.accountsService.findAll(user.id, includeArchived === 'true');
  }

  @Get('balances')
  getBalances(@CurrentUser() user: { id: string }) {
    return this.accountsService.getBalances(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.accountsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.accountsService.remove(user.id, id);
  }

  @Post(':id/reconcile')
  reconcile(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReconcileBalanceDto,
  ) {
    return this.accountsService.reconcile(user.id, id, dto);
  }
}
