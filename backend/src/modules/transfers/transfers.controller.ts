import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { QueryTransfersDto } from './dto/query-transfers.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { TransfersService } from './transfers.service';

@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryTransfersDto) {
    return this.transfers.findAll(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateTransferDto) {
    return this.transfers.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateTransferDto) {
    return this.transfers.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.transfers.remove(user.userId, id);
  }
}
