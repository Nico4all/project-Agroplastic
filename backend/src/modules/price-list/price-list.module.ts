import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';

@Module({ imports: [UsersModule], controllers: [PriceListController], providers: [PriceListService] })
export class PriceListModule {}
