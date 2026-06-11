import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return accounts.map(this.serialize);
  }

  async create(userId: string, dto: CreateAccountDto) {
    const initial = new Prisma.Decimal(dto.initialBalance || 0);
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        initialBalance: initial,
        currentBalance: initial,
      },
    });
    return this.serialize(account);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    await this.ensureOwner(userId, id);
    const account = await this.prisma.account.update({
      where: { id },
      data: dto,
    });
    return this.serialize(account);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwner(userId, id);
    const account = await this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });
    return this.serialize(account);
  }

  async ensureOwner(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return account;
  }

  private serialize(account: any) {
    return {
      ...account,
      initialBalance: decimalToNumber(account.initialBalance),
      currentBalance: decimalToNumber(account.currentBalance),
    };
  }
}
