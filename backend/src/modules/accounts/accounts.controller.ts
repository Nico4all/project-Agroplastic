import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.accounts.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateAccountDto) {
    return this.accounts.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.accounts.remove(user.userId, id);
  }
}
