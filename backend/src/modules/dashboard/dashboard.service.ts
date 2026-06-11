import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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
        this.getMonthlyFlow(userId, query, range),
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
        balanceEvolution: await this.getBalanceEvolution(userId, query),
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

  private resolveChartRange(query: DashboardQueryDto) {
    if (query.fromDate || query.toDate) return this.resolveRange(query);

    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }

  private monthsBetween(from: Date, to: Date) {
    const months: string[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);

    while (cursor <= end && months.length < 60) {
      months.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
  }

  private transactionWhere(userId: string, query: DashboardQueryDto, range: { from: Date; to: Date }): Prisma.TransactionWhereInput {
    return {
      userId,
      transactionDate: { gte: range.from, lte: range.to },
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
  }

  private async getMonthlyFlow(userId: string, query: DashboardQueryDto, range: { from: Date; to: Date }) {
    const chartRange = query.fromDate || query.toDate ? range : this.resolveChartRange(query);

    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: { gte: chartRange.from, lte: chartRange.to },
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
      select: { type: true, amount: true, transactionDate: true },
      orderBy: { transactionDate: 'asc' },
    });

    const buckets = new Map(
      this.monthsBetween(chartRange.from, chartRange.to).map((month) => [month, { month, income: 0, expense: 0, net: 0 }]),
    );

    rows.forEach((row) => {
      const month = monthKey(row.transactionDate);
      const bucket = buckets.get(month);
      if (!bucket) return;

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

  private async getBalanceEvolution(userId: string, query: DashboardQueryDto) {
    const range = this.resolveChartRange(query);
    const months = this.monthsBetween(range.from, range.to);

    const [accounts, transactions, transfers] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: { userId, ...(query.accountId ? { id: query.accountId } : {}) },
        select: { id: true, initialBalance: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          ...(query.accountId ? { accountId: query.accountId } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          transactionDate: { lte: range.to },
        },
        select: { type: true, amount: true, transactionDate: true },
        orderBy: { transactionDate: 'asc' },
      }),
      query.accountId && !query.categoryId
        ? this.prisma.transfer.findMany({
            where: {
              userId,
              transferDate: { lte: range.to },
              OR: [{ fromAccountId: query.accountId }, { toAccountId: query.accountId }],
            },
            select: { amount: true, transferDate: true, fromAccountId: true, toAccountId: true },
            orderBy: { transferDate: 'asc' },
          })
        : this.prisma.transfer.findMany({
            where: { id: '__none__' },
            select: { amount: true, transferDate: true, fromAccountId: true, toAccountId: true },
          }),
    ]);

    let running = accounts.reduce((sum, account) => sum + decimalToNumber(account.initialBalance), 0);
    const buckets = new Map(months.map((month) => [month, { transactionNet: 0, transferNet: 0 }]));

    transactions.forEach((row) => {
      const signedAmount = (row.type === TransactionType.INCOME ? 1 : -1) * decimalToNumber(row.amount);
      if (row.transactionDate < range.from) {
        running += signedAmount;
        return;
      }

      const bucket = buckets.get(monthKey(row.transactionDate));
      if (bucket) bucket.transactionNet += signedAmount;
    });

    transfers.forEach((row) => {
      if (!query.accountId) return;
      const sign = row.toAccountId === query.accountId ? 1 : row.fromAccountId === query.accountId ? -1 : 0;
      const signedAmount = sign * decimalToNumber(row.amount);
      if (row.transferDate < range.from) {
        running += signedAmount;
        return;
      }

      const bucket = buckets.get(monthKey(row.transferDate));
      if (bucket) bucket.transferNet += signedAmount;
    });

    return months.map((month) => {
      const bucket = buckets.get(month);
      running += (bucket?.transactionNet || 0) + (bucket?.transferNet || 0);
      return {
        date: `${month}-01`,
        label: `${MONTH_LABELS[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`,
        balance: running,
      };
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
