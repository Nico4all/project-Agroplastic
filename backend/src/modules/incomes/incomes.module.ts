import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { UsersModule } from '../users/users.module';
import { IncomesController } from './incomes.controller';
import { IncomesService } from './incomes.service';

@Module({
  imports: [ClientsModule, UsersModule],
  controllers: [IncomesController],
  providers: [IncomesService],
  exports: [IncomesService],
})
export class IncomesModule {}
