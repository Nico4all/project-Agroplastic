import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePortfolioCollectionDto } from './dto/create-portfolio-collection.dto';
import { QueryPortfolioCollectionsDto } from './dto/query-portfolio-collections.dto';
import { QueryPortfolioDto } from './dto/query-portfolio.dto';
import { UpdatePortfolioCausedStatusDto } from './dto/update-portfolio-caused-status.dto';
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

  @Get('collections')
  findCollections(@CurrentUser() user: { userId: string }, @Query() query: QueryPortfolioCollectionsDto) {
    return this.portfolio.findCollections(user.userId, query);
  }

  @Patch('collections/:id/caused')
  @HttpCode(200)
  updateCausedStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioCausedStatusDto,
  ) {
    return this.portfolio.updateCausedStatus(user.userId, id, dto.isCaused);
  }
}
