import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cleanDisplayText, normalizeDocumentSuffix } from '../../common/helpers/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreatePointOfSaleDto } from './dto/create-point-of-sale.dto';
import { UpdatePointOfSaleDto } from './dto/update-point-of-sale.dto';

const pointOfSaleSelect = {
  id: true,
  name: true,
  code: true,
  documentPrefix: true,
  nextIncomeNumber: true,
  nextExpenseNumber: true,
  nextOrderNumber: true,
  city: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true } },
} satisfies Prisma.PointOfSaleSelect;

@Injectable()
export class PointsOfSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(requestUserId: string) {
    await this.users.ensureAdmin(requestUserId);
    return this.prisma.pointOfSale.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: pointOfSaleSelect,
    });
  }

  async create(requestUserId: string, dto: CreatePointOfSaleDto) {
    await this.users.ensureAdmin(requestUserId);
    const data = this.normalizeData(dto);
    if (!data.name || !data.code || !data.documentPrefix) {
      throw new BadRequestException('El nombre, el codigo y el prefijo son obligatorios');
    }
    const counters = await this.nextCountersForPrefix(data.documentPrefix);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const pointOfSale = await tx.pointOfSale.create({
          data: { ...data, ...counters, name: data.name!, code: data.code!, documentPrefix: data.documentPrefix! },
          select: pointOfSaleSelect,
        });
        const products = await tx.priceListProduct.findMany({
          select: {
            id: true,
            defaultPrimaryPrice: true,
            defaultSecondaryPrice: true,
            defaultPrimaryNote: true,
            defaultSecondaryNote: true,
          },
        });
        if (products.length) {
          await tx.pointOfSalePrice.createMany({
            data: products.map((product) => ({
              pointOfSaleId: pointOfSale.id,
              productId: product.id,
              primaryPrice: product.defaultPrimaryPrice,
              secondaryPrice: product.defaultSecondaryPrice,
              primaryPriceNote: product.defaultPrimaryNote,
              secondaryPriceNote: product.defaultSecondaryNote,
            })),
          });
        }
        return pointOfSale;
      });
    } catch (error) {
      this.handleUniqueError(error);
      throw error;
    }
  }

  async update(requestUserId: string, id: string, dto: UpdatePointOfSaleDto) {
    await this.users.ensureAdmin(requestUserId);
    const current = await this.prisma.pointOfSale.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Punto de venta no encontrado');

    if (dto.isActive === false && current.isActive) {
      const activeUsers = await this.prisma.user.count({ where: { pointOfSaleId: id, isActive: true } });
      if (activeUsers > 0) {
        throw new ConflictException('No puedes desactivar un punto de venta que tiene usuarios activos');
      }
    }

    const normalized = this.normalizeData(dto);
    const prefixChanged = normalized.documentPrefix !== undefined && normalized.documentPrefix !== current.documentPrefix;
    const historicalCounters = prefixChanged
      ? await this.nextCountersForPrefix(normalized.documentPrefix!)
      : null;
    try {
      return await this.prisma.pointOfSale.update({
        where: { id },
        data: {
          ...normalized,
          ...(historicalCounters ? {
            nextIncomeNumber: Math.max(current.nextIncomeNumber, historicalCounters.nextIncomeNumber),
            nextExpenseNumber: Math.max(current.nextExpenseNumber, historicalCounters.nextExpenseNumber),
            nextOrderNumber: Math.max(current.nextOrderNumber, historicalCounters.nextOrderNumber),
          } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: pointOfSaleSelect,
      });
    } catch (error) {
      this.handleUniqueError(error);
      throw error;
    }
  }

  private normalizeData(dto: CreatePointOfSaleDto | UpdatePointOfSaleDto) {
    const name = dto.name === undefined ? undefined : cleanDisplayText(dto.name);
    const code = dto.code === undefined ? undefined : normalizeDocumentSuffix(dto.code);
    const documentPrefix = dto.documentPrefix === undefined ? undefined : normalizeDocumentSuffix(dto.documentPrefix);
    const city = dto.city === undefined ? undefined : cleanDisplayText(dto.city) || null;
    const address = dto.address === undefined ? undefined : cleanDisplayText(dto.address) || null;

    if (dto.name !== undefined && !name) throw new BadRequestException('El nombre es obligatorio');
    if (dto.code !== undefined && !code) throw new BadRequestException('El codigo es obligatorio');
    if (dto.documentPrefix !== undefined && !documentPrefix) throw new BadRequestException('El prefijo es obligatorio');

    return {
      ...(name !== undefined ? { name } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(documentPrefix !== undefined ? { documentPrefix } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(address !== undefined ? { address } : {}),
    };
  }

  private handleUniqueError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ya existe un punto de venta con ese codigo o prefijo');
    }
  }

  private async nextCountersForPrefix(documentPrefix: string) {
    const documentNumber = { startsWith: `${documentPrefix}-` };
    const [income, expense, order] = await Promise.all([
      this.prisma.income.aggregate({ where: { documentNumber }, _max: { documentSequence: true } }),
      this.prisma.expense.aggregate({ where: { documentNumber }, _max: { documentSequence: true } }),
      this.prisma.order.aggregate({ where: { documentNumber }, _max: { documentSequence: true } }),
    ]);
    return {
      nextIncomeNumber: (income._max.documentSequence ?? 0) + 1,
      nextExpenseNumber: (expense._max.documentSequence ?? 0) + 1,
      nextOrderNumber: (order._max.documentSequence ?? 0) + 1,
    };
  }
}
