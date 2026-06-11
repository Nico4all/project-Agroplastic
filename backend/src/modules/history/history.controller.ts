import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryHistoryDto } from './dto/query-history.dto';
import { HistoryService } from './history.service';

@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryHistoryDto) {
    return this.history.findAll(user.userId, query);
  }

  @Get('export')
  async exportCsv(@CurrentUser() user: { userId: string }, @Query() query: QueryHistoryDto, @Res() res: Response) {
    const csv = await this.history.exportCsv(user.userId, query);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="historicos.csv"');
    res.send(csv);
  }
}
