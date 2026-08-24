import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSavingsPotDto } from './dto/create-savings-pot.dto';
import { UpdateSavingsPotDto } from './dto/update-savings-pot.dto';
import { SavingsPotsService } from './savings-pots.service';

@Controller('savings-pots')
export class SavingsPotsController {
  constructor(private readonly savingsPotsService: SavingsPotsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateSavingsPotDto) {
    return this.savingsPotsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.savingsPotsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.savingsPotsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateSavingsPotDto) {
    return this.savingsPotsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.savingsPotsService.remove(user.id, id);
  }
}
