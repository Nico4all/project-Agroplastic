import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateIncomeDto } from './dto/create-income.dto';
import { QueryIncomesDto } from './dto/query-incomes.dto';
import { UpdateCausedStatusDto } from './dto/update-caused-status.dto';
import { VoidIncomeDto } from './dto/void-income.dto';
import { IncomesService } from './incomes.service';

@UseGuards(JwtAuthGuard)
@Controller('incomes')
export class IncomesController {
  constructor(private readonly incomes: IncomesService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryIncomesDto) {
    return this.incomes.findAll(user.userId, query);
  }

  @Get('export/excel')
  async exportExcel(@CurrentUser() user: { userId: string }, @Query() query: QueryIncomesDto, @Res() res: Response) {
    const html = await this.incomes.exportExcel(user.userId, query);
    res.header('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="ingresos.xls"');
    res.send(html);
  }

  @Get('export/pdf')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(@CurrentUser() user: { userId: string }, @Query() query: QueryIncomesDto, @Res() res: Response) {
    const pdf = await this.incomes.exportPdf(user.userId, query);
    res.header('Content-Disposition', 'attachment; filename="ingresos.pdf"');
    res.send(pdf);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async receiptPdf(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.incomes.receiptPdf(user.userId, id);
    res.header('Content-Disposition', `inline; filename="ingreso-${id}.pdf"`);
    res.send(pdf);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateIncomeDto) {
    return this.incomes.create(user.userId, dto);
  }

  @Patch(':id/void')
  @HttpCode(200)
  void(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: VoidIncomeDto) {
    return this.incomes.void(user.userId, id, dto);
  }

  @Patch(':id/caused')
  @HttpCode(200)
  updateCausedStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCausedStatusDto,
  ) {
    return this.incomes.updateCausedStatus(user.userId, id, dto.isCaused);
  }
}
