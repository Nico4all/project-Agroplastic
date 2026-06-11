import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryTransactionsDto) {
    return this.transactions.findAll(user.userId, query);
  }

  @Get('export')
  async exportCsv(
    @CurrentUser() user: { userId: string },
    @Query() query: QueryTransactionsDto,
    @Res() res: Response,
  ) {
    const csv = await this.transactions.exportCsv(user.userId, query);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="movimientos.csv"');
    res.send(csv);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.transactions.remove(user.userId, id);
  }
}
