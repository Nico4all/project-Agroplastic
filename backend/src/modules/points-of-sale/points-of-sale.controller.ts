import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePointOfSaleDto } from './dto/create-point-of-sale.dto';
import { UpdatePointOfSaleDto } from './dto/update-point-of-sale.dto';
import { PointsOfSaleService } from './points-of-sale.service';

@UseGuards(JwtAuthGuard)
@Controller('points-of-sale')
export class PointsOfSaleController {
  constructor(private readonly pointsOfSale: PointsOfSaleService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.pointsOfSale.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreatePointOfSaleDto) {
    return this.pointsOfSale.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdatePointOfSaleDto,
  ) {
    return this.pointsOfSale.update(user.userId, id, dto);
  }
}
