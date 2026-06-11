import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string, query: DashboardQueryDto) {
    const range = this.resolveRange(query);
    const transactionWhere = this.transactionWhere(userId, query, range);

    const [accounts, monthTotals, recentTransactions, recentTransfers, monthlyFlow, expensesByCategory] =
      await Promise.all([
        this.prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { name: 'asc' } }),
        this.prisma.transaction.groupBy({ by: ['type'], where: transactionWhere, orderBy: { type: 'asc' }, _sum: { amount: true } }),
        this.prisma.transaction.findMany({
          where: { userId },
          include: { account: true, category: true },
          orderBy: { transactionDate: 'desc' },
          take: 8,
        }),
        this.prisma.transfer.findMany({
          where: { userId },
          include: { fromAccount: true, toAccount: true },
          orderBy: { transferDate: 'desc' },
          take: 8,
        }),
        this.getMonthlyFlow(userId),
        this.getExpensesByCategory(transactionWhere),
      ]);

    const income = decimalToNumber(monthTotals.find((row) => row.type === 'INCOME')?._sum?.amount);
    const expense = decimalToNumber(monthTotals.find((row) => row.type === 'EXPENSE')?._sum?.amount);
    const totalBalance = accounts.reduce((sum, account) => sum + decimalToNumber(account.currentBalance), 0);

    return {
      summary: {
        totalBalance,
        income,
        expense,
        netFlow: income - expense,
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currentBalance: decimalToNumber(account.currentBalance),
      })),
      charts: {
        monthlyFlow,
        expensesByCategory,
        balanceEvolution: await this.getBalanceEvolution(userId),
        accountDistribution: accounts.map((account) => ({
          name: account.name,
          value: decimalToNumber(account.currentBalance),
        })),
      },
      recentMovements: [...recentTransactions.map(this.transactionItem), ...recentTransfers.map(this.transferItem)]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    };
  }

  private resolveRange(query: DashboardQueryDto) {
    const now = new Date();
    const from = query.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.toDate ? new Date(query.toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }

  private transactionWhere(userId: string, query: DashboardQueryDto, range: { from: Date; to: Date }): Prisma.TransactionWhereInput {
    return {
      userId,
      transactionDate: { gte: range.from, lte: range.to },
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
  }

  private async getMonthlyFlow(userId: string) {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);

    const rows = await this.prisma.transaction.findMany({
      where: { userId, transactionDate: { gte: since } },
      select: { type: true, amount: true, transactionDate: true },
      orderBy: { transactionDate: 'asc' },
    });

    const buckets = new Map<string, { month: string; income: number; expense: number; net: number }>();
    rows.forEach((row) => {
      const month = row.transactionDate.toISOString().slice(0, 7);
      const bucket = buckets.get(month) || { month, income: 0, expense: 0, net: 0 };
      const amount = decimalToNumber(row.amount);
      if (row.type === TransactionType.INCOME) bucket.income += amount;
      else bucket.expense += amount;
      bucket.net = bucket.income - bucket.expense;
      buckets.set(month, bucket);
    });
    return Array.from(buckets.values());
  }

  private async getExpensesByCategory(where: Prisma.TransactionWhereInput) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...where, type: 'EXPENSE' },
      orderBy: { categoryId: 'asc' },
      _sum: { amount: true },
    });
    const categories = await this.prisma.category.findMany({
      where: { id: { in: rows.map((row) => row.categoryId) } },
    });
    return rows.map((row) => {
      const category = categories.find((item) => item.id === row.categoryId);
      return {
        categoryId: row.categoryId,
        name: category?.name || 'Sin categoria',
        color: category?.color || '#64748b',
        value: decimalToNumber(row._sum.amount),
      };
    });
  }

  private async getBalanceEvolution(userId: string) {
    const rows = await this.prisma.transaction.findMany({
      where: { userId },
      select: { type: true, amount: true, transactionDate: true },
      orderBy: { transactionDate: 'asc' },
    });
    let balance = 0;
    return rows.map((row) => {
      balance += row.type === 'INCOME' ? decimalToNumber(row.amount) : -decimalToNumber(row.amount);
      return { date: row.transactionDate.toISOString().slice(0, 10), balance };
    });
  }

  private transactionItem(row: any) {
    return {
      id: row.id,
      kind: 'TRANSACTION',
      type: row.type,
      amount: decimalToNumber(row.amount),
      date: row.transactionDate,
      description: row.description,
      account: row.account?.name,
      category: row.category?.name,
    };
  }

  private transferItem(row: any) {
    return {
      id: row.id,
      kind: 'TRANSFER',
      type: 'TRANSFER',
      amount: decimalToNumber(row.amount),
      date: row.transferDate,
      description: row.description,
      account: `${row.fromAccount?.name} -> ${row.toAccount?.name}`,
      category: 'Transferencia',
    };
  }
}
