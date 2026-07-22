import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateInvoicedStatusDto } from './dto/update-invoiced-status.dto';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryOrdersDto) {
    return this.orders.findAll(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.userId, dto);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async ticketPdf(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.orders.ticketPdf(user.userId, id);
    res.header('Content-Disposition', `inline; filename="pedido-${id}.pdf"`);
    res.send(pdf);
  }

  @Patch(':id/invoiced')
  @HttpCode(200)
  updateInvoicedStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateInvoicedStatusDto,
  ) {
    return this.orders.updateInvoicedStatus(user.userId, id, dto.isInvoiced);
  }
}
