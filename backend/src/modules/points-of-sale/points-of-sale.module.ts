import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PointsOfSaleController } from './points-of-sale.controller';
import { PointsOfSaleService } from './points-of-sale.service';

@Module({
  imports: [UsersModule],
  controllers: [PointsOfSaleController],
  providers: [PointsOfSaleService],
})
export class PointsOfSaleModule {}
