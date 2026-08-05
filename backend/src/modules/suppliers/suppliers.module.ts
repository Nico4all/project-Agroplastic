import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({ imports: [UsersModule], controllers: [SuppliersController], providers: [SuppliersService] })
export class SuppliersModule {}
