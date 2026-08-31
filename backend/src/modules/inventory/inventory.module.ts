import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({ imports: [UsersModule], controllers: [InventoryController], providers: [InventoryService] })
export class InventoryModule {}
