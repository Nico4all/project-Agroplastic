import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryProductHistoryDto } from './dto/query-product-history.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stocks')
  findStocks(@CurrentUser() user: { userId: string }, @Query() query: QueryInventoryDto) {
    return this.inventory.findStocks(user.userId, query);
  }

  @Get('stocks/export/excel')
  async exportStocksExcel(
    @CurrentUser() user: { userId: string },
    @Query() query: QueryInventoryDto,
    @Res() res: Response,
  ) {
    const file = await this.inventory.exportStocksExcel(user.userId, query);
    this.sendFile(res, file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  @Get('stocks/export/pdf')
  async exportStocksPdf(
    @CurrentUser() user: { userId: string },
    @Query() query: QueryInventoryDto,
    @Res() res: Response,
  ) {
    const file = await this.inventory.exportStocksPdf(user.userId, query);
    this.sendFile(res, file, 'application/pdf');
  }

  @Get('entries')
  findEntries(@CurrentUser() user: { userId: string }, @Query() query: QueryInventoryDto) {
    return this.inventory.findEntries(user.userId, query);
  }

  @Get('history')
  findProductHistory(@CurrentUser() user: { userId: string }, @Query() query: QueryProductHistoryDto) {
    return this.inventory.findProductHistory(user.userId, query);
  }

  @Get('history/export/excel')
  async exportProductHistoryExcel(
    @CurrentUser() user: { userId: string },
    @Query() query: QueryProductHistoryDto,
    @Res() res: Response,
  ) {
    const file = await this.inventory.exportProductHistoryExcel(user.userId, query);
    this.sendFile(res, file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  @Post('entries')
  createEntry(@CurrentUser() user: { userId: string }, @Body() dto: CreateInventoryEntryDto) {
    return this.inventory.createEntry(user.userId, dto);
  }

  @Post('adjustments')
  adjustStock(@CurrentUser() user: { userId: string }, @Body() dto: CreateInventoryAdjustmentDto) {
    return this.inventory.adjustStock(user.userId, dto);
  }

  private sendFile(res: Response, file: { buffer: Buffer; filename: string }, contentType: string) {
    const asciiFilename = file.filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ._-]/g, '');
    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.send(file.buffer);
  }
}
