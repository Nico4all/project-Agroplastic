import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryType, Prisma, Transaction, TransactionType } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryTransactionsDto) {
    const where = this.buildWhere(userId, query);
    const [total, data, grouped] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: { account: true, category: true },
        orderBy: { transactionDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where,
        orderBy: { type: 'asc' },
        _sum: { amount: true },
      }),
    ]);

    return {
      data: data.map(this.serialize),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        income: decimalToNumber(grouped.find((g) => g.type === 'INCOME')?._sum?.amount),
        expense: decimalToNumber(grouped.find((g) => g.type === 'EXPENSE')?._sum?.amount),
      },
    };
  }

  async create(userId: string, dto: CreateTransactionDto) {
    await this.validateRelations(userId, dto.accountId, dto.categoryId, dto.type);
    const amount = new Prisma.Decimal(dto.amount);

    const created = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId,
          type: dto.type,
          amount,
          description: dto.description,
          transactionDate: new Date(dto.transactionDate),
        },
        include: { account: true, category: true },
      });
      await this.applyTransactionEffect(tx, transaction.accountId, transaction.type, transaction.amount);
      return transaction;
    });

    return this.serialize(created);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const current = await this.findOwned(userId, id);
    const next = {
      accountId: dto.accountId ?? current.accountId,
      categoryId: dto.categoryId ?? current.categoryId,
      type: dto.type ?? current.type,
      amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : current.amount,
      description: dto.description ?? current.description,
      transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : current.transactionDate,
    };

    await this.validateRelations(userId, next.accountId, next.categoryId, next.type);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.revertTransactionEffect(tx, current.accountId, current.type, current.amount);
      const transaction = await tx.transaction.update({
        where: { id },
        data: next,
        include: { account: true, category: true },
      });
      await this.applyTransactionEffect(tx, transaction.accountId, transaction.type, transaction.amount);
      return transaction;
    });

    return this.serialize(updated);
  }

  async remove(userId: string, id: string) {
    const current = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await this.revertTransactionEffect(tx, current.accountId, current.type, current.amount);
      await tx.transaction.delete({ where: { id } });
    });
    return { ok: true };
  }

  async exportCsv(userId: string, query: QueryTransactionsDto) {
    const rows = await this.prisma.transaction.findMany({
      where: this.buildWhere(userId, { ...query, page: 1, pageSize: 100 } as QueryTransactionsDto),
      include: { account: true, category: true },
      orderBy: { transactionDate: query.sort || 'desc' },
      take: 10000,
    });

    const header = ['Fecha', 'Tipo', 'Cuenta', 'Categoria', 'Descripcion', 'Monto'];
    const body = rows.map((row) => [
      row.transactionDate.toISOString().slice(0, 10),
      row.type,
      row.account.name,
      row.category.name,
      row.description || '',
      decimalToNumber(row.amount).toFixed(2),
    ]);

    return [header, ...body].map((line) => line.map(this.csvCell).join(',')).join('\n');
  }

  private async findOwned(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { account: true, category: true },
    });
    if (!transaction) throw new NotFoundException('Movimiento no encontrado');
    return transaction;
  }

  private async validateRelations(userId: string, accountId: string, categoryId: string, type: TransactionType) {
    const [account, category] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: accountId, userId, isActive: true } }),
      this.prisma.category.findFirst({ where: { id: categoryId, userId, isActive: true } }),
    ]);
    if (!account) throw new BadRequestException('La cuenta no pertenece al usuario o esta inactiva');
    if (!category) throw new BadRequestException('La categoria no pertenece al usuario o esta inactiva');
    if (category.type !== (type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE)) {
      throw new BadRequestException('La categoria no corresponde al tipo de movimiento');
    }
  }

  private async applyTransactionEffect(
    tx: Prisma.TransactionClient,
    accountId: string,
    type: TransactionType,
    amount: Prisma.Decimal,
  ) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: type === 'INCOME' ? { increment: amount } : { decrement: amount } },
    });
  }

  private async revertTransactionEffect(
    tx: Prisma.TransactionClient,
    accountId: string,
    type: TransactionType,
    amount: Prisma.Decimal,
  ) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: type === 'INCOME' ? { decrement: amount } : { increment: amount } },
    });
  }

  private buildWhere(userId: string, query: QueryTransactionsDto): Prisma.TransactionWhereInput {
    const date: any = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = new Date(query.toDate);

    const amount: any = {};
    if (query.minAmount !== undefined) amount.gte = new Prisma.Decimal(query.minAmount);
    if (query.maxAmount !== undefined) amount.lte = new Prisma.Decimal(query.maxAmount);

    return {
      userId,
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(Object.keys(date).length ? { transactionDate: date } : {}),
      ...(Object.keys(amount).length ? { amount } : {}),
      ...(query.search ? { description: { contains: query.search } } : {}),
    };
  }

  private serialize(row: Transaction & { account?: any; category?: any }) {
    return {
      ...row,
      amount: decimalToNumber(row.amount),
      account: row.account
        ? { id: row.account.id, name: row.account.name, type: row.account.type, currentBalance: decimalToNumber(row.account.currentBalance) }
        : undefined,
      category: row.category ? { id: row.category.id, name: row.category.name, type: row.category.type, color: row.category.color, icon: row.category.icon } : undefined,
    };
  }

  private csvCell(value: string) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }
}
