import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { QueryHistoryDto } from './dto/query-history.dto';

type HistoryItem = {
  id: string;
  sourceId: string;
  kind: string;
  type: string;
  typeLabel: string;
  direction: 'IN' | 'OUT' | 'NEUTRAL';
  amount: number;
  date: Date;
  account: { id?: string; name: string };
  category: { id?: string; name: string };
  description: string;
};

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryHistoryDto) {
    const items = await this.getItems(userId, query);
    const sorted = items.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      return query.sort === 'asc' ? diff : -diff;
    });
    const start = (query.page - 1) * query.pageSize;
    const data = sorted.slice(start, start + query.pageSize);

    return {
      data: data.map(this.serialize),
      total: sorted.length,
      page: query.page,
      pageSize: query.pageSize,
      summary: this.summary(sorted),
    };
  }

  async exportCsv(userId: string, query: QueryHistoryDto) {
    const items = await this.getItems(userId, { ...query, page: 1, pageSize: 100 } as QueryHistoryDto);
    const sorted = items.sort((a, b) => (query.sort === 'asc' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));
    const header = ['Fecha', 'Tipo', 'Cuenta', 'Categoria', 'Descripcion', 'Monto'];
    const body = sorted.map((item) => [
      item.date.toISOString().slice(0, 10),
      item.typeLabel,
      item.account.name,
      item.category.name,
      item.description,
      item.amount.toFixed(2),
    ]);
    return [header, ...body].map((line) => line.map(this.csvCell).join(',')).join('\n');
  }

  private async getItems(userId: string, query: QueryHistoryDto) {
    const [transactions, transfers, loans, payments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: this.transactionWhere(userId, query),
        include: { account: true, category: true },
      }),
      query.categoryId
        ? []
        : this.prisma.transfer.findMany({
            where: this.transferWhere(userId, query),
            include: { fromAccount: true, toAccount: true },
          }),
      query.categoryId
        ? []
        : this.prisma.loan.findMany({
            where: this.loanWhere(userId, query),
            include: { account: true },
          }),
      query.categoryId
        ? []
        : this.prisma.loanPayment.findMany({
            where: this.loanPaymentWhere(userId, query),
            include: { account: true, loan: true },
          }),
    ]);

    return [
      ...transactions.map((row): HistoryItem => ({
        id: `transaction-${row.id}`,
        sourceId: row.id,
        kind: 'TRANSACTION',
        type: row.type,
        typeLabel: row.type === 'INCOME' ? 'Ingreso' : 'Gasto',
        direction: row.type === 'INCOME' ? 'IN' : 'OUT',
        amount: decimalToNumber(row.amount),
        date: row.transactionDate,
        account: { id: row.account.id, name: row.account.name },
        category: { id: row.category.id, name: row.category.name },
        description: row.description || '',
      })),
      ...transfers.map((row): HistoryItem => ({
        id: `transfer-${row.id}`,
        sourceId: row.id,
        kind: 'TRANSFER',
        type: 'TRANSFER',
        typeLabel: 'Transferencia',
        direction: 'NEUTRAL',
        amount: decimalToNumber(row.amount),
        date: row.transferDate,
        account: { name: `${row.fromAccount.name} -> ${row.toAccount.name}` },
        category: { name: 'Transferencia' },
        description: row.description || '',
      })),
      ...loans.map((row): HistoryItem => ({
        id: `loan-${row.id}`,
        sourceId: row.id,
        kind: 'LOAN',
        type: row.type === 'RECEIVABLE' ? 'LOAN_RECEIVABLE' : 'LOAN_PAYABLE',
        typeLabel: row.type === 'RECEIVABLE' ? 'Prestamo entregado' : 'Prestamo recibido',
        direction: row.type === 'RECEIVABLE' ? 'OUT' : 'IN',
        amount: decimalToNumber(row.principalAmount),
        date: row.loanDate,
        account: { id: row.account.id, name: row.account.name },
        category: { name: row.type === 'RECEIVABLE' ? 'Cuenta por cobrar' : 'Cuenta por pagar' },
        description: `${row.personName}${row.description ? ` - ${row.description}` : ''}`,
      })),
      ...payments.map((row): HistoryItem => ({
        id: `loan-payment-${row.id}`,
        sourceId: row.id,
        kind: 'LOAN_PAYMENT',
        type: row.loan.type === 'RECEIVABLE' ? 'LOAN_PAYMENT_RECEIVED' : 'LOAN_PAYMENT_PAID',
        typeLabel: row.loan.type === 'RECEIVABLE' ? 'Pago recibido de prestamo' : 'Pago realizado de prestamo',
        direction: row.loan.type === 'RECEIVABLE' ? 'IN' : 'OUT',
        amount: decimalToNumber(row.amount),
        date: row.paymentDate,
        account: { id: row.account.id, name: row.account.name },
        category: { name: row.loan.type === 'RECEIVABLE' ? 'Abono por cobrar' : 'Abono por pagar' },
        description: `${row.loan.personName}${row.description ? ` - ${row.description}` : ''}`,
      })),
    ].filter((item) => this.matchesSharedFilters(item, query));
  }

  private transactionWhere(userId: string, query: QueryHistoryDto): Prisma.TransactionWhereInput {
    const date: any = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = new Date(query.toDate);
    const amount = this.amountFilter(query);
    return {
      userId,
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.type === 'INCOME' || query.type === 'EXPENSE' ? { type: query.type } : query.type ? { id: '__none__' } : {}),
      ...(Object.keys(date).length ? { transactionDate: date } : {}),
      ...(Object.keys(amount).length ? { amount } : {}),
    };
  }

  private transferWhere(userId: string, query: QueryHistoryDto): Prisma.TransferWhereInput {
    const date: any = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = new Date(query.toDate);
    const amount = this.amountFilter(query);
    return {
      userId,
      ...(query.type && query.type !== 'TRANSFER' ? { id: '__none__' } : {}),
      ...(query.accountId ? { OR: [{ fromAccountId: query.accountId }, { toAccountId: query.accountId }] } : {}),
      ...(Object.keys(date).length ? { transferDate: date } : {}),
      ...(Object.keys(amount).length ? { amount } : {}),
    };
  }

  private loanWhere(userId: string, query: QueryHistoryDto): Prisma.LoanWhereInput {
    const date: any = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = new Date(query.toDate);
    const amount = this.amountFilter(query);
    return {
      userId,
      ...(query.type === 'LOAN_RECEIVABLE' ? { type: 'RECEIVABLE' as const } : {}),
      ...(query.type === 'LOAN_PAYABLE' ? { type: 'PAYABLE' as const } : {}),
      ...(query.type && !['LOAN_RECEIVABLE', 'LOAN_PAYABLE'].includes(query.type) ? { id: '__none__' } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(Object.keys(date).length ? { loanDate: date } : {}),
      ...(Object.keys(amount).length ? { principalAmount: amount } : {}),
    };
  }

  private loanPaymentWhere(userId: string, query: QueryHistoryDto): Prisma.LoanPaymentWhereInput {
    const date: any = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = new Date(query.toDate);
    const amount = this.amountFilter(query);
    return {
      userId,
      ...(query.type === 'LOAN_PAYMENT_RECEIVED' ? { loan: { type: 'RECEIVABLE' as const } } : {}),
      ...(query.type === 'LOAN_PAYMENT_PAID' ? { loan: { type: 'PAYABLE' as const } } : {}),
      ...(query.type && !['LOAN_PAYMENT_RECEIVED', 'LOAN_PAYMENT_PAID'].includes(query.type) ? { id: '__none__' } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(Object.keys(date).length ? { paymentDate: date } : {}),
      ...(Object.keys(amount).length ? { amount } : {}),
    };
  }

  private amountFilter(query: QueryHistoryDto) {
    const amount: any = {};
    if (query.minAmount !== undefined) amount.gte = new Prisma.Decimal(query.minAmount);
    if (query.maxAmount !== undefined) amount.lte = new Prisma.Decimal(query.maxAmount);
    return amount;
  }

  private matchesSharedFilters(item: HistoryItem, query: QueryHistoryDto) {
    if (!query.search) return true;
    const text = `${item.typeLabel} ${item.account.name} ${item.category.name} ${item.description}`.toLowerCase();
    return text.includes(query.search.toLowerCase());
  }

  private summary(items: HistoryItem[]) {
    return items.reduce(
      (acc, item) => {
        if (item.type === 'INCOME') acc.income += item.amount;
        if (item.type === 'EXPENSE') acc.expense += item.amount;
        if (item.kind === 'LOAN_PAYMENT' && item.direction === 'IN') acc.loanPaymentsIn += item.amount;
        if (item.kind === 'LOAN_PAYMENT' && item.direction === 'OUT') acc.loanPaymentsOut += item.amount;
        if (item.kind === 'LOAN' && item.direction === 'IN') acc.loansIn += item.amount;
        if (item.kind === 'LOAN' && item.direction === 'OUT') acc.loansOut += item.amount;
        return acc;
      },
      { income: 0, expense: 0, loanPaymentsIn: 0, loanPaymentsOut: 0, loansIn: 0, loansOut: 0 },
    );
  }

  private serialize(item: HistoryItem) {
    return {
      ...item,
      date: item.date,
      transactionDate: item.date,
    };
  }

  private csvCell(value: string) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }
}
