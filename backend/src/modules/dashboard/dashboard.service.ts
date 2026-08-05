import { Injectable } from '@nestjs/common';
import { Prisma, RecordStatus, User, UserRole } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminRole } from '../../common/helpers/roles';
import { UsersService } from '../users/users.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type DashboardUser = {
  id: string;
  name: string;
  username: string;
  pointOfSale: { documentPrefix: string } | null;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async getDashboard(userId: string, query: DashboardQueryDto) {
    const actor = await this.users.getActiveUser(userId);
    const range = this.resolveRange(query);
    const incomeWhere = this.incomeWhere(actor, query, range);
    const expenseWhere = this.expenseWhere(actor, query, range);
    const relevantUsers = await this.relevantUsers(actor, query);

    const [incomeSum, expenseSum, expensesByUser, recentExpensesByUser, recentIncomesByUser] = await Promise.all([
      this.prisma.income.aggregate({ where: { ...incomeWhere, status: RecordStatus.ACTIVE }, _sum: { amount: true } }),
      this.prisma.expense.aggregate({ where: { ...expenseWhere, status: RecordStatus.ACTIVE }, _sum: { amount: true } }),
      this.getExpensesByUser(expenseWhere),
      this.getRecentExpensesByUser(relevantUsers, expenseWhere),
      this.getRecentIncomesByUser(relevantUsers, incomeWhere),
    ]);

    const income = decimalToNumber(incomeSum._sum.amount);
    const expense = decimalToNumber(expenseSum._sum.amount);

    return {
      summary: {
        income,
        expense,
        net: income - expense,
      },
      expensesByUser,
      recentExpensesByUser,
      recentIncomesByUser,
      filters: {
        fromDate: range.from.toISOString(),
        toDate: range.to.toISOString(),
      },
    };
  }

  private async getExpensesByUser(where: Prisma.ExpenseWhereInput) {
    const rows = await this.prisma.expense.groupBy({
      by: ['userId'],
      where: { ...where, status: RecordStatus.ACTIVE },
      _sum: { amount: true },
      orderBy: { userId: 'asc' },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.userId) } },
      select: { id: true, name: true, username: true, pointOfSale: { select: { documentPrefix: true } } },
    });
    return rows
      .map((row) => {
        const user = users.find((item) => item.id === row.userId);
        return {
          userId: row.userId,
          name: user?.name || 'Usuario',
          username: user?.username || '',
          documentPrefix: user?.pointOfSale?.documentPrefix || '',
          value: decimalToNumber(row._sum.amount),
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  private async getRecentExpensesByUser(users: DashboardUser[], where: Prisma.ExpenseWhereInput) {
    const groups = await Promise.all(
      users.map(async (user) => {
        const items = await this.prisma.expense.findMany({
          where: { ...where, userId: user.id },
          include: { category: true },
          orderBy: { expenseDate: 'desc' },
          take: 5,
        });
        return {
          user,
          items: items.map((item) => ({
            id: item.id,
            date: item.expenseDate,
            documentNumber: item.documentNumber,
            category: item.category.name,
            paidTo: item.paidTo,
            status: item.status,
            amount: decimalToNumber(item.amount),
          })),
        };
      }),
    );
    return groups.filter((group) => group.items.length);
  }

  private async getRecentIncomesByUser(users: DashboardUser[], where: Prisma.IncomeWhereInput) {
    const groups = await Promise.all(
      users.map(async (user) => {
        const items = await this.prisma.income.findMany({
          where: { ...where, userId: user.id },
          orderBy: { incomeDate: 'desc' },
          take: 5,
        });
        return {
          user,
          items: items.map((item) => ({
            id: item.id,
            date: item.incomeDate,
            documentNumber: item.documentNumber,
            clientName: item.clientName,
            clientDocument: item.clientDocument,
            type: item.type,
            paymentMethod: item.paymentMethod,
            status: item.status,
            amount: decimalToNumber(item.amount),
          })),
        };
      }),
    );
    return groups.filter((group) => group.items.length);
  }

  private async relevantUsers(actor: User, query: DashboardQueryDto) {
    return this.prisma.user.findMany({
      where: {
        ...(isAdminRole(actor.role) ? { role: UserRole.BODEGA } : { pointOfSaleId: actor.pointOfSaleId! }),
        ...(isAdminRole(actor.role) && query.userId ? { id: query.userId } : {}),
      },
      select: { id: true, name: true, username: true, pointOfSale: { select: { documentPrefix: true } } },
      orderBy: { name: 'asc' },
    });
  }

  private resolveRange(query: DashboardQueryDto) {
    const now = new Date();
    const from = query.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.toDate ? this.endOfDay(query.toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }

  private incomeWhere(actor: User, query: DashboardQueryDto, range: { from: Date; to: Date }): Prisma.IncomeWhereInput {
    return {
      incomeDate: { gte: range.from, lte: range.to },
      ...(isAdminRole(actor.role) ? {} : { pointOfSaleId: actor.pointOfSaleId! }),
      ...(isAdminRole(actor.role) && query.userId ? { userId: query.userId } : {}),
    };
  }

  private expenseWhere(actor: User, query: DashboardQueryDto, range: { from: Date; to: Date }): Prisma.ExpenseWhereInput {
    return {
      expenseDate: { gte: range.from, lte: range.to },
      ...(isAdminRole(actor.role) ? {} : { pointOfSaleId: actor.pointOfSaleId! }),
      ...(isAdminRole(actor.role) && query.userId ? { userId: query.userId } : {}),
    };
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
