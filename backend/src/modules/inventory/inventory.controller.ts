import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { CreateInventoryTransferDto } from './dto/create-inventory-transfer.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryProductHistoryDto } from './dto/query-product-history.dto';
import { UpdateInventoryEntryDto } from './dto/update-inventory-entry.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { UpdateInventoryTransferDto } from './dto/update-inventory-transfer.dto';
import { VoidInventoryEntryDto } from './dto/void-inventory-entry.dto';
import { VoidInventoryAdjustmentDto } from './dto/void-inventory-adjustment.dto';
import { VoidInventoryTransferDto } from './dto/void-inventory-transfer.dto';
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

  @Get('entries/:id/pdf')
  async entryTicketPdf(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.inventory.entryTicketPdf(user.userId, id);
    this.sendInlinePdf(res, pdf, `entrada-${id}.pdf`);
  }

  @Get('history')
  findProductHistory(@CurrentUser() user: { userId: string }, @Query() query: QueryProductHistoryDto) {
    return this.inventory.findProductHistory(user.userId, query);
  }

  @Get('adjustments')
  findAdjustments(@CurrentUser() user: { userId: string }, @Query() query: QueryInventoryDto) {
    return this.inventory.findAdjustments(user.userId, query);
  }

  @Get('adjustments/:id/pdf')
  async adjustmentTicketPdf(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.inventory.adjustmentTicketPdf(user.userId, id);
    this.sendInlinePdf(res, pdf, `ajuste-${id}.pdf`);
  }

  @Get('transfers')
  findTransfers(@CurrentUser() user: { userId: string }, @Query() query: QueryInventoryDto) {
    return this.inventory.findTransfers(user.userId, query);
  }

  @Get('transfers/:id/pdf')
  async transferTicketPdf(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.inventory.transferTicketPdf(user.userId, id);
    this.sendInlinePdf(res, pdf, `traslado-${id}.pdf`);
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

  @Patch('entries/:id')
  @HttpCode(200)
  updateEntry(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateInventoryEntryDto,
  ) {
    return this.inventory.updateEntry(user.userId, id, dto);
  }

  @Patch('entries/:id/void')
  @HttpCode(200)
  voidEntry(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: VoidInventoryEntryDto,
  ) {
    return this.inventory.voidEntry(user.userId, id, dto);
  }

  @Post('adjustments')
  adjustStock(@CurrentUser() user: { userId: string }, @Body() dto: CreateInventoryAdjustmentDto) {
    return this.inventory.adjustStock(user.userId, dto);
  }

  @Patch('adjustments/:id')
  @HttpCode(200)
  updateAdjustment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateInventoryAdjustmentDto,
  ) {
    return this.inventory.updateAdjustment(user.userId, id, dto);
  }

  @Patch('adjustments/:id/void')
  @HttpCode(200)
  voidAdjustment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: VoidInventoryAdjustmentDto,
  ) {
    return this.inventory.voidAdjustment(user.userId, id, dto);
  }

  @Post('transfers')
  transferStock(@CurrentUser() user: { userId: string }, @Body() dto: CreateInventoryTransferDto) {
    return this.inventory.transferStock(user.userId, dto);
  }

  @Patch('transfers/:id')
  @HttpCode(200)
  updateTransfer(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateInventoryTransferDto,
  ) {
    return this.inventory.updateTransfer(user.userId, id, dto);
  }

  @Patch('transfers/:id/void')
  @HttpCode(200)
  voidTransfer(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: VoidInventoryTransferDto,
  ) {
    return this.inventory.voidTransfer(user.userId, id, dto);
  }

  private sendFile(res: Response, file: { buffer: Buffer; filename: string }, contentType: string) {
    const asciiFilename = file.filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ._-]/g, '');
    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.send(file.buffer);
  }

  private sendInlinePdf(res: Response, pdf: Buffer, filename: string) {
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  }
}
