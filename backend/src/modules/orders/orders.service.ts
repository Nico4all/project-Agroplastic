import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma, RecordStatus, User } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { buildOrderTicketPdf, formatDate } from '../../common/helpers/reports';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminRole } from '../../common/helpers/roles';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { VoidOrderDto } from './dto/void-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly clients: ClientsService,
  ) {}

  async findAll(userId: string, query: QueryOrdersDto) {
    const actor = await this.users.getActiveUser(userId);
    const where = this.buildWhere(actor, query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: this.includeRelations(),
        orderBy: { createdAt: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      data: data.map((order) => this.serialize(order)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(userId: string, dto: CreateOrderDto) {
    const actor = await this.users.getActiveUser(userId);
    if (!actor.pointOfSaleId) throw new BadRequestException('Debes tener un punto de venta asignado para registrar pedidos');
    const client = await this.clients.findAccessible(actor, dto.clientId);
    if (!client.isActive) throw new BadRequestException('El cliente esta inactivo');

    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('No repitas el mismo producto en un pedido');
    }

    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        pointOfSaleId: actor.pointOfSaleId,
        productId: { in: productIds },
        isActive: true,
      },
      include: { product: true },
    });
    if (stocks.length !== productIds.length) {
      throw new BadRequestException('Uno o mas productos no pertenecen a este punto de venta o estan inactivos');
    }
    const stocksByProduct = new Map(stocks.map((stock) => [stock.productId, stock]));
    const items = dto.items.map((item) => {
      const stock = stocksByProduct.get(item.productId)!;
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return {
        productId: stock.productId,
        productDescription: stock.product.description,
        quantity,
        unitPrice,
        lineTotal: quantity.mul(unitPrice).toDecimalPlaces(2),
      };
    });
    const totalAmount = items.reduce((total, item) => total.add(item.lineTotal), new Prisma.Decimal(0));

    const order = await this.prisma.$transaction(async (transaction) => {
      const numberedPointOfSale = await transaction.pointOfSale.update({
        where: { id: actor.pointOfSaleId! },
        data: { nextOrderNumber: { increment: 1 } },
        select: { documentPrefix: true, nextOrderNumber: true, isActive: true },
      });
      if (!numberedPointOfSale.isActive) throw new BadRequestException('El punto de venta asignado esta inactivo');
      const documentSequence = numberedPointOfSale.nextOrderNumber - 1;

      const now = new Date();
      const created = await transaction.order.create({
        data: {
          userId: actor.id,
          pointOfSaleId: actor.pointOfSaleId,
          clientId: client.id,
          documentSequence,
          documentNumber: `${numberedPointOfSale.documentPrefix}-${documentSequence}`,
          clientName: client.fullName,
          clientDocument: client.identityDocument,
          deliveryAddress: dto.deliveryAddress.trim(),
          clientPhone: dto.clientPhone.trim(),
          paymentMethod: dto.paymentMethod,
          observations: dto.observations?.trim() || null,
          totalAmount,
          status: RecordStatus.ACTIVE,
          inventoryAppliedAt: now,
          items: { create: items },
        },
        include: this.includeRelations(),
      });

      for (const item of items) {
        const changed = await transaction.inventoryStock.updateMany({
          where: {
            pointOfSaleId: actor.pointOfSaleId!,
            productId: item.productId,
            isActive: true,
            quantity: { gte: item.quantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });
        if (changed.count !== 1) {
          throw new BadRequestException(`Inventario insuficiente para ${item.productDescription}`);
        }
        const stock = await transaction.inventoryStock.findUniqueOrThrow({
          where: { pointOfSaleId_productId: { pointOfSaleId: actor.pointOfSaleId!, productId: item.productId } },
        });
        await transaction.inventoryMovement.create({
          data: {
            pointOfSaleId: actor.pointOfSaleId!,
            productId: item.productId,
            userId: actor.id,
            orderId: created.id,
            type: InventoryMovementType.ORDER,
            quantityChange: item.quantity.negated(),
            balanceAfter: stock.quantity,
          },
        });
      }
      return created;
    });

    return this.serialize(order);
  }

  async updateInvoicedStatus(userId: string, id: string, isInvoiced: boolean) {
    await this.users.ensureAdmin(userId);
    const current = await this.prisma.order.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Pedido no encontrado');
    if (isInvoiced && current.status === RecordStatus.VOID) {
      throw new BadRequestException('No puedes facturar un pedido anulado');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { invoicedAt: isInvoiced ? new Date() : null },
      include: this.includeRelations(),
    });
    return this.serialize(updated);
  }

  async void(userId: string, id: string, dto: VoidOrderDto) {
    const actor = await this.users.getActiveUser(userId);
    const current = await this.findAccessible(actor, id, true);
    if (current.status === RecordStatus.VOID) return this.serialize(current);

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id, status: RecordStatus.ACTIVE },
        data: {
          status: RecordStatus.VOID,
          invoicedAt: null,
          voidReason: dto.reason?.trim() || null,
          voidedAt: new Date(),
          voidedByUserId: actor.id,
        },
      });
      if (changed.count !== 1) throw new BadRequestException('El pedido ya fue anulado');

      if (current.inventoryAppliedAt) {
        for (const item of current.items) {
          const stock = await tx.inventoryStock.update({
            where: {
              pointOfSaleId_productId: {
                pointOfSaleId: current.pointOfSaleId!,
                productId: item.productId,
              },
            },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              pointOfSaleId: current.pointOfSaleId!,
              productId: item.productId,
              userId: actor.id,
              orderId: current.id,
              type: InventoryMovementType.ORDER_VOID,
              quantityChange: item.quantity,
              balanceAfter: stock.quantity,
            },
          });
        }
      }
      return tx.order.findUniqueOrThrow({ where: { id }, include: this.includeRelations() });
    });
    return this.serialize(updated);
  }

  async ticketPdf(userId: string, id: string) {
    const actor = await this.users.getActiveUser(userId);
    const order = await this.findAccessible(actor, id);
    return buildOrderTicketPdf({
      number: order.documentNumber,
      date: formatDate(order.createdAt),
      clientName: order.clientName,
      clientDocument: order.clientDocument,
      deliveryAddress: order.deliveryAddress || '',
      clientPhone: order.clientPhone || '',
      paymentMethod:
        order.paymentMethod === 'BANK'
          ? 'Banco'
          : order.paymentMethod === 'CASH'
            ? 'Efectivo'
            : order.paymentMethod === 'CREDIT'
              ? 'Credito'
              : 'No registrado',
      observations: order.observations || '',
      userName: order.user.name,
      invoiced: Boolean(order.invoicedAt),
      voided: order.status === RecordStatus.VOID,
      voidReason: order.voidReason || undefined,
      items: order.items.map((item) => ({
        description: item.productDescription,
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        lineTotal: decimalToNumber(item.lineTotal),
      })),
      total: decimalToNumber(order.totalAmount),
    });
  }

  private async findAccessible(actor: User, id: string, requireOwnership = false) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        ...(isAdminRole(actor.role)
          ? {}
          : requireOwnership
            ? { userId: actor.id }
            : { pointOfSaleId: actor.pointOfSaleId! }),
      },
      include: this.includeRelations(),
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  private buildWhere(actor: User, query: QueryOrdersDto): Prisma.OrderWhereInput {
    const and: Prisma.OrderWhereInput[] = [];
    if (!isAdminRole(actor.role)) and.push({ pointOfSaleId: actor.pointOfSaleId! });
    if (query.search) {
      and.push({
        OR: [
          { documentNumber: { contains: query.search } },
          { clientName: { contains: query.search } },
          { clientDocument: { contains: query.search } },
          { deliveryAddress: { contains: query.search } },
          { clientPhone: { contains: query.search } },
          { observations: { contains: query.search } },
          { items: { some: { productDescription: { contains: query.search } } } },
        ],
      });
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.fromDate) createdAt.gte = new Date(query.fromDate);
    if (query.toDate) createdAt.lte = this.endOfDay(query.toDate);

    return {
      ...(and.length ? { AND: and } : {}),
      ...(isAdminRole(actor.role) && query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
  }

  private includeRelations() {
    return {
      user: { select: { id: true, name: true, username: true, role: true } },
      pointOfSale: { select: { id: true, name: true, code: true, documentPrefix: true } },
      client: { select: { id: true, fullName: true, identityDocument: true } },
      voidedBy: { select: { id: true, name: true, username: true } },
      items: { orderBy: { productDescription: 'asc' as const } },
    };
  }

  private serialize(order: any) {
    return {
      ...order,
      totalAmount: decimalToNumber(order.totalAmount),
      items: order.items.map((item: any) => ({
        ...item,
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        lineTotal: decimalToNumber(item.lineTotal),
      })),
    };
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
