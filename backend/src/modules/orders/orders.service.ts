import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { buildOrderTicketPdf, formatDate } from '../../common/helpers/reports';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

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
    const client = await this.clients.findAccessible(actor, dto.clientId);
    if (!client.isActive) throw new BadRequestException('El cliente esta inactivo');

    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('No repitas el mismo producto en un pedido');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o mas productos no existen o estan inactivos');
    }
    const productsById = new Map(products.map((product) => [product.id, product]));
    const items = dto.items.map((item) => {
      const product = productsById.get(item.productId)!;
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return {
        productId: product.id,
        productDescription: product.description,
        quantity,
        unitPrice,
        lineTotal: quantity.mul(unitPrice).toDecimalPlaces(2),
      };
    });
    const totalAmount = items.reduce((total, item) => total.add(item.lineTotal), new Prisma.Decimal(0));

    const order = await this.prisma.$transaction(async (transaction) => {
      const numberedUser = await transaction.user.update({
        where: { id: actor.id },
        data: { nextOrderNumber: { increment: 1 } },
        select: { documentSuffix: true, nextOrderNumber: true },
      });
      const documentSequence = numberedUser.nextOrderNumber - 1;

      return transaction.order.create({
        data: {
          userId: actor.id,
          clientId: client.id,
          documentSequence,
          documentNumber: `${numberedUser.documentSuffix}-${documentSequence}`,
          clientName: client.fullName,
          clientDocument: client.identityDocument,
          deliveryAddress: dto.deliveryAddress.trim(),
          clientPhone: dto.clientPhone.trim(),
          paymentMethod: dto.paymentMethod,
          observations: dto.observations?.trim() || null,
          totalAmount,
          items: { create: items },
        },
        include: this.includeRelations(),
      });
    });

    return this.serialize(order);
  }

  async updateInvoicedStatus(userId: string, id: string, isInvoiced: boolean) {
    await this.users.ensureAdmin(userId);
    const current = await this.prisma.order.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Pedido no encontrado');

    const updated = await this.prisma.order.update({
      where: { id },
      data: { invoicedAt: isInvoiced ? new Date() : null },
      include: this.includeRelations(),
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
      paymentMethod: order.paymentMethod === 'BANK' ? 'Banco' : order.paymentMethod === 'CASH' ? 'Efectivo' : 'No registrado',
      observations: order.observations || '',
      userName: order.user.name,
      invoiced: Boolean(order.invoicedAt),
      items: order.items.map((item) => ({
        description: item.productDescription,
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        lineTotal: decimalToNumber(item.lineTotal),
      })),
      total: decimalToNumber(order.totalAmount),
    });
  }

  private async findAccessible(actor: User, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, ...(actor.role === UserRole.ADMIN ? {} : { userId: actor.id }) },
      include: this.includeRelations(),
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  private buildWhere(actor: User, query: QueryOrdersDto): Prisma.OrderWhereInput {
    const and: Prisma.OrderWhereInput[] = [];
    if (actor.role !== UserRole.ADMIN) and.push({ userId: actor.id });
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
      ...(actor.role === UserRole.ADMIN && query.userId ? { userId: query.userId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
  }

  private includeRelations() {
    return {
      user: { select: { id: true, name: true, username: true, documentSuffix: true, role: true } },
      client: { select: { id: true, fullName: true, identityDocument: true } },
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
