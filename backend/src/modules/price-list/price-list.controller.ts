import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

  @Post('products')
  createProduct(@CurrentUser() user: { userId: string }, @Body() dto: CreatePriceListProductDto) {
    return this.priceList.createProduct(user.userId, dto);
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
