import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BulkUpdatePriceListPricesDto } from './dto/bulk-update-price-list-prices.dto';
import { CreatePriceListCategoryDto } from './dto/create-price-list-category.dto';
import { CreatePriceListProductDto } from './dto/create-price-list-product.dto';
import { QueryPriceListProductsDto } from './dto/query-price-list-products.dto';
import { UpdatePriceListProductDto } from './dto/update-price-list-product.dto';
import { PriceListService } from './price-list.service';

@UseGuards(JwtAuthGuard)
@Controller('price-list')
export class PriceListController {
  constructor(private readonly priceList: PriceListService) {}

  @Get('categories')
  categories(@CurrentUser() user: { userId: string }) {
    return this.priceList.categories(user.userId);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: { userId: string }, @Body() dto: CreatePriceListCategoryDto) {
    return this.priceList.createCategory(user.userId, dto);
  }

  @Get('products')
  products(@CurrentUser() user: { userId: string }, @Query() query: QueryPriceListProductsDto) {
    return this.priceList.products(user.userId, query);
  }

  @Get('products/export/excel')
  async exportProductsExcel(
    @CurrentUser() user: { userId: string },
    @Query() query: QueryPriceListProductsDto,
    @Res() res: Response,
  ) {
    const file = await this.priceList.exportProductsExcel(user.userId, query);
    const asciiFilename = file.filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ._-]/g, '');
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.send(file.buffer);
  }

  @Post('products')
  createProduct(@CurrentUser() user: { userId: string }, @Body() dto: CreatePriceListProductDto) {
    return this.priceList.createProduct(user.userId, dto);
  }

  @Patch('products/prices/bulk')
  bulkUpdatePrices(@CurrentUser() user: { userId: string }, @Body() dto: BulkUpdatePriceListPricesDto) {
    return this.priceList.bulkUpdatePrices(user.userId, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdatePriceListProductDto,
  ) {
    return this.priceList.updateProduct(user.userId, id, dto);
  }
}
