import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Loan, LoanPayment, LoanType, Prisma } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { CreateLoanPaymentDto } from './dto/create-loan-payment.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryLoansDto) {
    const where: Prisma.LoanWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { personName: { contains: query.search } } : {}),
    };

    const [loans, grouped] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        include: { account: true, payments: { orderBy: { paymentDate: 'desc' } } },
        orderBy: [{ status: 'asc' }, { loanDate: 'desc' }],
      }),
      this.prisma.loan.groupBy({
        by: ['type', 'status'],
        where,
        orderBy: [{ type: 'asc' }, { status: 'asc' }],
        _sum: { principalAmount: true, remainingAmount: true },
      }),
    ]);

    return {
      data: loans.map(this.serializeLoan),
      summary: {
        receivableOpen: decimalToNumber(grouped.find((row) => row.type === 'RECEIVABLE' && row.status === 'OPEN')?._sum?.remainingAmount),
        payableOpen: decimalToNumber(grouped.find((row) => row.type === 'PAYABLE' && row.status === 'OPEN')?._sum?.remainingAmount),
      },
    };
  }

  async create(userId: string, dto: CreateLoanDto) {
    await this.ensureAccountOwner(userId, dto.accountId);
    const principal = new Prisma.Decimal(dto.principalAmount);

    const loan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.loan.create({
        data: {
          userId,
          accountId: dto.accountId,
          personName: dto.personName,
          type: dto.type,
          principalAmount: principal,
          remainingAmount: principal,
          loanDate: new Date(dto.loanDate),
          description: dto.description,
        },
        include: { account: true, payments: true },
      });
      await this.applyLoanInitialEffect(tx, dto.accountId, dto.type, principal);
      return created;
    });

    return this.serializeLoan(loan);
  }

  async update(userId: string, id: string, dto: UpdateLoanDto) {
    await this.findOwned(userId, id);
    const loan = await this.prisma.loan.update({
      where: { id },
      data: {
        ...(dto.personName !== undefined ? { personName: dto.personName } : {}),
        ...(dto.loanDate !== undefined ? { loanDate: new Date(dto.loanDate) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
      include: { account: true, payments: { orderBy: { paymentDate: 'desc' } } },
    });
    return this.serializeLoan(loan);
  }

  async remove(userId: string, id: string) {
    const loan = await this.findOwned(userId, id);
    const payments = await this.prisma.loanPayment.count({ where: { loanId: id, userId } });
    if (payments > 0) {
      throw new BadRequestException('No se puede eliminar un prestamo con pagos registrados. Elimina los pagos primero.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.revertLoanInitialEffect(tx, loan.accountId, loan.type, loan.principalAmount);
      await tx.loan.delete({ where: { id } });
    });
    return { ok: true };
  }

  async findPayments(userId: string, loanId: string) {
    await this.findOwned(userId, loanId);
    const payments = await this.prisma.loanPayment.findMany({
      where: { userId, loanId },
      include: { account: true },
      orderBy: { paymentDate: 'desc' },
    });
    return payments.map(this.serializePayment);
  }

  async createPayment(userId: string, loanId: string, dto: CreateLoanPaymentDto) {
    const loan = await this.findOwned(userId, loanId);
    await this.ensureAccountOwner(userId, dto.accountId);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.gt(loan.remainingAmount)) {
      throw new BadRequestException('El abono no puede ser mayor al saldo pendiente');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.loanPayment.create({
        data: {
          userId,
          loanId,
          accountId: dto.accountId,
          amount,
          paymentDate: new Date(dto.paymentDate),
          description: dto.description,
        },
        include: { account: true },
      });
      await this.applyPaymentEffect(tx, dto.accountId, loan.type, amount);
      const remainingAmount = loan.remainingAmount.minus(amount);
      await tx.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount,
          status: remainingAmount.lte(0) ? 'PAID' : 'OPEN',
        },
      });
      return created;
    });

    return this.serializePayment(payment);
  }

  async removePayment(userId: string, loanId: string, paymentId: string) {
    const loan = await this.findOwned(userId, loanId);
    const payment = await this.prisma.loanPayment.findFirst({ where: { id: paymentId, loanId, userId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    await this.prisma.$transaction(async (tx) => {
      await this.revertPaymentEffect(tx, payment.accountId, loan.type, payment.amount);
      await tx.loanPayment.delete({ where: { id: paymentId } });
      await tx.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount: { increment: payment.amount },
          status: 'OPEN',
        },
      });
    });
    return { ok: true };
  }

  private async findOwned(userId: string, id: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id, userId },
      include: { account: true, payments: { orderBy: { paymentDate: 'desc' } } },
    });
    if (!loan) throw new NotFoundException('Prestamo no encontrado');
    return loan;
  }

  private async ensureAccountOwner(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, isActive: true } });
    if (!account) throw new BadRequestException('La cuenta debe existir, estar activa y pertenecer al usuario');
    return account;
  }

  private async applyLoanInitialEffect(tx: Prisma.TransactionClient, accountId: string, type: LoanType, amount: Prisma.Decimal) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: type === 'RECEIVABLE' ? { decrement: amount } : { increment: amount } },
    });
  }

  private async revertLoanInitialEffect(tx: Prisma.TransactionClient, accountId: string, type: LoanType, amount: Prisma.Decimal) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: type === 'RECEIVABLE' ? { increment: amount } : { decrement: amount } },
    });
  }

  private async applyPaymentEffect(tx: Prisma.TransactionClient, accountId: string, type: LoanType, amount: Prisma.Decimal) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: type === 'RECEIVABLE' ? { increment: amount } : { decrement: amount } },
    });
  }

  private async revertPaymentEffect(tx: Prisma.TransactionClient, accountId: string, type: LoanType, amount: Prisma.Decimal) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: type === 'RECEIVABLE' ? { decrement: amount } : { increment: amount } },
    });
  }

  private serializeLoan(loan: Loan & { account?: any; payments?: LoanPayment[] }) {
    return {
      ...loan,
      principalAmount: decimalToNumber(loan.principalAmount),
      remainingAmount: decimalToNumber(loan.remainingAmount),
      paidAmount: decimalToNumber(loan.principalAmount) - decimalToNumber(loan.remainingAmount),
      account: loan.account ? { id: loan.account.id, name: loan.account.name, type: loan.account.type } : undefined,
      payments: loan.payments?.map((payment) => ({
        ...payment,
        amount: decimalToNumber(payment.amount),
      })),
    };
  }

  private serializePayment(payment: LoanPayment & { account?: any }) {
    return {
      ...payment,
      amount: decimalToNumber(payment.amount),
      account: payment.account ? { id: payment.account.id, name: payment.account.name } : undefined,
    };
  }
}
