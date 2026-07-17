import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { UpdateCausedStatusDto } from './dto/update-caused-status.dto';
import { VoidExpenseDto } from './dto/void-expense.dto';
import { ExpensesService } from './expenses.service';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryExpensesDto) {
    return this.expenses.findAll(user.userId, query);
  }

  @Get('export/excel')
  async exportExcel(@CurrentUser() user: { userId: string }, @Query() query: QueryExpensesDto, @Res() res: Response) {
    const html = await this.expenses.exportExcel(user.userId, query);
    res.header('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="egresos.xls"');
    res.send(html);
  }

  @Get('export/pdf')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(@CurrentUser() user: { userId: string }, @Query() query: QueryExpensesDto, @Res() res: Response) {
    const pdf = await this.expenses.exportPdf(user.userId, query);
    res.header('Content-Disposition', 'attachment; filename="egresos.pdf"');
    res.send(pdf);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async receiptPdf(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.expenses.receiptPdf(user.userId, id);
    res.header('Content-Disposition', `inline; filename="egreso-${id}.pdf"`);
    res.send(pdf);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.userId, dto);
  }

  @Patch(':id/void')
  @HttpCode(200)
  void(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: VoidExpenseDto) {
    return this.expenses.void(user.userId, id, dto);
  }

  @Patch(':id/caused')
  @HttpCode(200)
  updateCausedStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCausedStatusDto,
  ) {
    return this.expenses.updateCausedStatus(user.userId, id, dto.isCaused);
  }
}
