import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: { userId: string }, @Query() query: DashboardQueryDto) {
    return this.dashboard.getDashboard(user.userId, query);
  }
}
