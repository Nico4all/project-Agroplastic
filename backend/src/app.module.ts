import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HistoryModule } from './modules/history/history.module';
import { LoansModule } from './modules/loans/loans.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api*'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    TransfersModule,
    LoansModule,
    HistoryModule,
    DashboardModule,
  ],
})
export class AppModule {}
