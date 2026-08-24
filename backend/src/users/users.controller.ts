import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReconcileBalanceDto } from './dto/reconcile-balance.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  update(@CurrentUser() user: { id: string }, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @Get('me/balance')
  getBalance(@CurrentUser() user: { id: string }) {
    return this.usersService.getBalance(user.id);
  }

  @Post('me/reconcile')
  reconcile(@CurrentUser() user: { id: string }, @Body() dto: ReconcileBalanceDto) {
    return this.usersService.reconcile(user.id, dto);
  }
}
