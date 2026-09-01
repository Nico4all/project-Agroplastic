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
import { OrdersModule } from './modules/orders/orders.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProductsModule } from './modules/products/products.module';
import { UsersModule } from './modules/users/users.module';
import { PointsOfSaleModule } from './modules/points-of-sale/points-of-sale.module';
import { PriceListModule } from './modules/price-list/price-list.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';

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
    PointsOfSaleModule,
    ClientsModule,
    ExpenseCategoriesModule,
    IncomesModule,
    ExpensesModule,
    ProductsModule,
    InventoryModule,
    SuppliersModule,
    PriceListModule,
    OrdersModule,
    PortfolioModule,
    DashboardModule,
  ],
})
export class AppModule {}
