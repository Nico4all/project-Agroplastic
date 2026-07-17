import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpenseCategoriesModule } from './modules/expense-categories/expense-categories.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { IncomesModule } from './modules/incomes/incomes.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';

const appBasePath = process.env.APP_BASE_PATH || '/caja-bodega';
const normalizedBasePath = `/${appBasePath.replace(/^\/+|\/+$/g, '')}`;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: normalizedBasePath,
      exclude: [`${normalizedBasePath}/api{/*path}`],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ExpenseCategoriesModule,
    IncomesModule,
    ExpensesModule,
    DashboardModule,
  ],
})
export class AppModule {}
