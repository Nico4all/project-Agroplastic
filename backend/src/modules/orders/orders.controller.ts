import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
