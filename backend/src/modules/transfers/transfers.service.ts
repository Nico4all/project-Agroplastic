import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Transfer } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { QueryTransfersDto } from './dto/query-transfers.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryTransfersDto) {
    const where = this.buildWhere(userId, query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.transfer.count({ where }),
      this.prisma.transfer.findMany({
        where,
        include: { fromAccount: true, toAccount: true },
        orderBy: { transferDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data: data.map(this.serialize), total, page: query.page, pageSize: query.pageSize };
  }

  async create(userId: string, dto: CreateTransferDto) {
    await this.validateAccounts(userId, dto.fromAccountId, dto.toAccountId);
    const amount = new Prisma.Decimal(dto.amount);

    const transfer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          userId,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount,
          description: dto.description,
          transferDate: new Date(dto.transferDate),
        },
        include: { fromAccount: true, toAccount: true },
      });
      await this.applyTransfer(tx, created.fromAccountId, created.toAccountId, created.amount);
      return created;
    });

    return this.serialize(transfer);
  }

  async update(userId: string, id: string, dto: UpdateTransferDto) {
    const current = await this.findOwned(userId, id);
    const next = {
      fromAccountId: dto.fromAccountId ?? current.fromAccountId,
      toAccountId: dto.toAccountId ?? current.toAccountId,
      amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : current.amount,
      description: dto.description ?? current.description,
      transferDate: dto.transferDate ? new Date(dto.transferDate) : current.transferDate,
    };

    await this.validateAccounts(userId, next.fromAccountId, next.toAccountId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.revertTransfer(tx, current.fromAccountId, current.toAccountId, current.amount);
      const transfer = await tx.transfer.update({
        where: { id },
        data: next,
        include: { fromAccount: true, toAccount: true },
      });
      await this.applyTransfer(tx, transfer.fromAccountId, transfer.toAccountId, transfer.amount);
      return transfer;
    });

    return this.serialize(updated);
  }

  async remove(userId: string, id: string) {
    const current = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await this.revertTransfer(tx, current.fromAccountId, current.toAccountId, current.amount);
      await tx.transfer.delete({ where: { id } });
    });
    return { ok: true };
  }

  private async findOwned(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: { id, userId },
      include: { fromAccount: true, toAccount: true },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    return transfer;
  }

  private async validateAccounts(userId: string, fromAccountId: string, toAccountId: string) {
    if (fromAccountId === toAccountId) {
      throw new BadRequestException('No se permite transferir a la misma cuenta');
    }
    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: fromAccountId, userId, isActive: true } }),
      this.prisma.account.findFirst({ where: { id: toAccountId, userId, isActive: true } }),
    ]);
    if (!fromAccount || !toAccount) {
      throw new BadRequestException('Las cuentas deben existir, estar activas y pertenecer al usuario');
    }
  }

  private async applyTransfer(tx: Prisma.TransactionClient, fromAccountId: string, toAccountId: string, amount: Prisma.Decimal) {
    await tx.account.update({ where: { id: fromAccountId }, data: { currentBalance: { decrement: amount } } });
    await tx.account.update({ where: { id: toAccountId }, data: { currentBalance: { increment: amount } } });
  }

  private async revertTransfer(tx: Prisma.TransactionClient, fromAccountId: string, toAccountId: string, amount: Prisma.Decimal) {
    await tx.account.update({ where: { id: fromAccountId }, data: { currentBalance: { increment: amount } } });
    await tx.account.update({ where: { id: toAccountId }, data: { currentBalance: { decrement: amount } } });
  }

  private buildWhere(userId: string, query: QueryTransfersDto): Prisma.TransferWhereInput {
    const date: any = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = new Date(query.toDate);
    return {
      userId,
      ...(Object.keys(date).length ? { transferDate: date } : {}),
      ...(query.accountId
        ? { OR: [{ fromAccountId: query.accountId }, { toAccountId: query.accountId }] }
        : {}),
    };
  }

  private serialize(row: Transfer & { fromAccount?: any; toAccount?: any }) {
    return {
      ...row,
      amount: decimalToNumber(row.amount),
      fromAccount: row.fromAccount ? { id: row.fromAccount.id, name: row.fromAccount.name } : undefined,
      toAccount: row.toAccount ? { id: row.toAccount.id, name: row.toAccount.name } : undefined,
    };
  }
}
