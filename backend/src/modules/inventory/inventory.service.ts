import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma, User } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { cleanDisplayText } from '../../common/helpers/normalization';
import { isAdminRole } from '../../common/helpers/roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findStocks(userId: string, query: QueryInventoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const rows = await this.prisma.inventoryStock.findMany({
      where: {
        pointOfSaleId,
        ...(query.search ? { product: { description: { contains: query.search } } } : {}),
      },
      include: { product: true, pointOfSale: { select: { id: true, name: true } } },
      orderBy: { product: { description: 'asc' } },
    });
    return rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      pointOfSaleId: row.pointOfSaleId,
      pointOfSale: row.pointOfSale,
      productDescription: row.product.description,
      quantity: decimalToNumber(row.quantity),
      isActive: Boolean(row.isActive),
      updatedAt: row.updatedAt,
    }));
  }

  async findEntries(userId: string, query: QueryInventoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const entryDate: Prisma.DateTimeFilter = {};
    if (query.fromDate) entryDate.gte = new Date(query.fromDate);
    if (query.toDate) entryDate.lte = this.endOfDay(query.toDate);
    const where: Prisma.InventoryEntryWhereInput = {
      pointOfSaleId,
      ...(Object.keys(entryDate).length ? { entryDate } : {}),
      ...(query.search
        ? {
            OR: [
              { documentNumber: { contains: query.search } },
              { supplierName: { contains: query.search } },
              { remittanceNumber: { contains: query.search } },
              { items: { some: { productDescription: { contains: query.search } } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryEntry.count({ where }),
      this.prisma.inventoryEntry.findMany({
        where,
        include: this.entryRelations(),
        orderBy: { entryDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data: rows.map((row) => this.serializeEntry(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async createEntry(userId: string, dto: CreateInventoryEntryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, dto.pointOfSaleId);
    const supplierName = cleanDisplayText(dto.supplierName);
    if (!supplierName) throw new BadRequestException('El proveedor es obligatorio');
    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('No repitas el mismo producto en una entrada');
    }
    const stocks = await this.prisma.inventoryStock.findMany({
      where: { pointOfSaleId, productId: { in: productIds }, isActive: true },
      include: { product: true },
    });
    if (stocks.length !== productIds.length) {
      throw new BadRequestException('Uno o mas productos no pertenecen a este punto de venta o estan inactivos');
    }
    const stocksByProduct = new Map(stocks.map((stock) => [stock.productId, stock]));

    const entry = await this.prisma.$transaction(async (tx) => {
      const numberedPoint = await tx.pointOfSale.update({
        where: { id: pointOfSaleId },
        data: { nextInventoryEntryNumber: { increment: 1 } },
        select: { documentPrefix: true, nextInventoryEntryNumber: true, isActive: true },
      });
      if (!numberedPoint.isActive) throw new BadRequestException('El punto de venta esta inactivo');
      const documentSequence = numberedPoint.nextInventoryEntryNumber - 1;
      const created = await tx.inventoryEntry.create({
        data: {
          userId: actor.id,
          pointOfSaleId,
          documentSequence,
          documentNumber: `${numberedPoint.documentPrefix}-EM-${documentSequence}`,
          supplierName,
          remittanceNumber: cleanDisplayText(dto.remittanceNumber || '') || null,
          observations: dto.observations?.trim() || null,
          entryDate: new Date(dto.entryDate),
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              productDescription: stocksByProduct.get(item.productId)!.product.description,
              quantity: new Prisma.Decimal(item.quantity),
            })),
          },
        },
      });

      for (const item of dto.items) {
        const quantity = new Prisma.Decimal(item.quantity);
        const stock = await tx.inventoryStock.update({
          where: { pointOfSaleId_productId: { pointOfSaleId, productId: item.productId } },
          data: { quantity: { increment: quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            pointOfSaleId,
            productId: item.productId,
            userId: actor.id,
            inventoryEntryId: created.id,
            type: InventoryMovementType.ENTRY,
            quantityChange: quantity,
            balanceAfter: stock.quantity,
          },
        });
      }
      return tx.inventoryEntry.findUniqueOrThrow({ where: { id: created.id }, include: this.entryRelations() });
    });
    return this.serializeEntry(entry);
  }

  private async resolvePointOfSale(actor: User, requested?: string) {
    const pointOfSaleId = isAdminRole(actor.role) ? requested || actor.pointOfSaleId : actor.pointOfSaleId;
    if (!pointOfSaleId) throw new BadRequestException('Selecciona un punto de venta');
    const point = await this.prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
    if (!point || !point.isActive) throw new BadRequestException('El punto de venta no existe o esta inactivo');
    return pointOfSaleId;
  }

  private entryRelations() {
    return {
      user: { select: { id: true, name: true, username: true } },
      pointOfSale: { select: { id: true, name: true, code: true } },
      items: { orderBy: { productDescription: 'asc' as const } },
    };
  }

  private serializeEntry(row: any) {
    return { ...row, items: row.items.map((item: any) => ({ ...item, quantity: decimalToNumber(item.quantity) })) };
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
