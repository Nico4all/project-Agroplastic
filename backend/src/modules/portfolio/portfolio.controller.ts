import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePortfolioCollectionDto } from './dto/create-portfolio-collection.dto';
import { QueryPortfolioDto } from './dto/query-portfolio.dto';
import { PortfolioService } from './portfolio.service';

@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryPortfolioDto) {
    return this.portfolio.findAll(user.userId, query);
  }

  @Post('collections')
  collect(@CurrentUser() user: { userId: string }, @Body() dto: CreatePortfolioCollectionDto) {
    return this.portfolio.collect(user.userId, dto);
  }
}
