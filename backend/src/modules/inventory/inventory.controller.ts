import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stocks')
  findStocks(@CurrentUser() user: { userId: string }, @Query() query: QueryInventoryDto) {
    return this.inventory.findStocks(user.userId, query);
  }

  @Get('entries')
  findEntries(@CurrentUser() user: { userId: string }, @Query() query: QueryInventoryDto) {
    return this.inventory.findEntries(user.userId, query);
  }

  @Post('entries')
  createEntry(@CurrentUser() user: { userId: string }, @Body() dto: CreateInventoryEntryDto) {
    return this.inventory.createEntry(user.userId, dto);
  }
}
