import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderPaymentMethod, Prisma, RecordStatus, User } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { isAdminRole } from '../../common/helpers/roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreatePortfolioCollectionDto } from './dto/create-portfolio-collection.dto';
import { QueryPortfolioCollectionsDto } from './dto/query-portfolio-collections.dto';
import { QueryPortfolioDto } from './dto/query-portfolio.dto';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(userId: string, query: QueryPortfolioDto) {
    const actor = await this.users.getActiveUser(userId);
    const orders = await this.prisma.order.findMany({
      where: this.buildWhere(actor, query),
      include: this.orderRelations(),
      orderBy: { createdAt: 'asc' },
    });
    const openOrders = orders.map((order) => this.serializeOrder(order)).filter((order) => order.balanceDue > 0);
    const clients = new Map<string, any>();
    openOrders.forEach((order) => {
      const current = clients.get(order.clientId) ?? {
        clientId: order.clientId,
        clientName: order.clientName,
        clientDocument: order.clientDocument,
        totalCredit: 0,
        collectedAmount: 0,
        balanceDue: 0,
        orders: [],
      };
      current.totalCredit += order.creditAmount;
      current.collectedAmount += order.collectedAmount;
      current.balanceDue += order.balanceDue;
      current.orders.push(order);
      clients.set(order.clientId, current);
    });
    const clientRows = [...clients.values()].sort((a, b) => a.clientName.localeCompare(b.clientName, 'es-CO'));
    return {
      summary: {
        clients: clientRows.length,
        orders: openOrders.length,
        totalCredit: openOrders.reduce((sum, order) => sum + order.creditAmount, 0),
        collectedAmount: openOrders.reduce((sum, order) => sum + order.collectedAmount, 0),
        balanceDue: openOrders.reduce((sum, order) => sum + order.balanceDue, 0),
      },
      clients: clientRows,
    };
  }

  async collect(userId: string, dto: CreatePortfolioCollectionDto) {
    const actor = await this.users.getActiveUser(userId);
    const amount = new Prisma.Decimal(dto.amount);
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: dto.orderId,
          status: RecordStatus.ACTIVE,
          ...(!isAdminRole(actor.role) ? { pointOfSaleId: actor.pointOfSaleId! } : {}),
        },
        include: this.orderRelations(),
      });
      if (!order) throw new NotFoundException('Pedido de cartera no encontrado');
      if (!order.pointOfSaleId) throw new BadRequestException('El pedido no tiene un punto de venta asociado');
      const balanceDue = this.serializeOrder(order).balanceDue;
      if (amount.greaterThan(new Prisma.Decimal(balanceDue))) {
        throw new BadRequestException(`El recaudo no puede superar el saldo pendiente (${this.formatMoney(balanceDue)})`);
      }
      const point = await tx.pointOfSale.update({
        where: { id: order.pointOfSaleId! },
        data: { nextPortfolioCollectionNumber: { increment: 1 } },
        select: { documentPrefix: true, nextPortfolioCollectionNumber: true, isActive: true },
      });
      if (!point.isActive) throw new BadRequestException('El punto de venta está inactivo');
      const documentSequence = point.nextPortfolioCollectionNumber - 1;
      const collection = await tx.portfolioCollection.create({
        data: {
          userId: actor.id,
          pointOfSaleId: order.pointOfSaleId!,
          orderId: order.id,
          documentSequence,
          documentNumber: `${point.documentPrefix}-RC-${documentSequence}`,
          paymentMethod: dto.paymentMethod,
          amount,
          description: dto.description?.trim() || `Recaudo pedido ${order.documentNumber}`,
          collectionDate: new Date(dto.collectionDate),
        },
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
          pointOfSale: { select: { id: true, name: true, code: true, documentPrefix: true } },
        },
      });
      return { collection, orderNumber: order.documentNumber };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ...result.collection, amount: decimalToNumber(result.collection.amount), orderNumber: result.orderNumber };
  }

  async findCollections(userId: string, query: QueryPortfolioCollectionsDto) {
    const actor = await this.users.getActiveUser(userId);
    const collectionDate: Prisma.DateTimeFilter = {};
    if (query.fromDate) collectionDate.gte = new Date(query.fromDate);
    if (query.toDate) collectionDate.lte = this.endOfDay(query.toDate);
    const where: Prisma.PortfolioCollectionWhereInput = {
      ...(!isAdminRole(actor.role)
        ? { pointOfSaleId: actor.pointOfSaleId! }
        : query.pointOfSaleId
          ? { pointOfSaleId: query.pointOfSaleId }
          : {}),
      ...(Object.keys(collectionDate).length ? { collectionDate } : {}),
      ...(query.isCaused !== undefined ? { causedAt: query.isCaused ? { not: null } : null } : {}),
      ...(query.search
        ? {
            OR: [
              { documentNumber: { contains: query.search } },
              { description: { contains: query.search } },
              { order: { documentNumber: { contains: query.search } } },
              { order: { clientName: { contains: query.search } } },
              { order: { clientDocument: { contains: query.search } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.portfolioCollection.count({ where }),
      this.prisma.portfolioCollection.findMany({
        where,
        include: this.collectionRelations(),
        orderBy: { collectionDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: rows.map((row) => ({ ...row, amount: decimalToNumber(row.amount) })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async updateCausedStatus(userId: string, id: string, isCaused: boolean) {
    await this.users.ensureAdmin(userId);
    const current = await this.prisma.portfolioCollection.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Recaudo de cartera no encontrado');
    const updated = await this.prisma.portfolioCollection.update({
      where: { id },
      data: { causedAt: isCaused ? new Date() : null },
      include: this.collectionRelations(),
    });
    return { ...updated, amount: decimalToNumber(updated.amount) };
  }

  private buildWhere(actor: User, query: QueryPortfolioDto): Prisma.OrderWhereInput {
    const scope = isAdminRole(actor.role)
      ? query.pointOfSaleId
        ? { pointOfSaleId: query.pointOfSaleId }
        : {}
      : { pointOfSaleId: actor.pointOfSaleId! };
    return {
      ...scope,
      status: RecordStatus.ACTIVE,
      payments: { some: { method: OrderPaymentMethod.CREDIT, amount: { gt: 0 } } },
      ...(query.search
        ? {
            OR: [
              { documentNumber: { contains: query.search } },
              { clientName: { contains: query.search } },
              { clientDocument: { contains: query.search } },
            ],
          }
        : {}),
    };
  }

  private orderRelations() {
    return {
      client: { select: { id: true, fullName: true, identityDocument: true } },
      pointOfSale: { select: { id: true, name: true, code: true } },
      payments: { orderBy: { createdAt: 'asc' as const } },
      collections: {
        select: { id: true, documentNumber: true, paymentMethod: true, amount: true, collectionDate: true, description: true },
        orderBy: { collectionDate: 'asc' as const },
      },
    };
  }

  private collectionRelations() {
    return {
      user: { select: { id: true, name: true, username: true, role: true } },
      pointOfSale: { select: { id: true, name: true, code: true } },
      order: {
        select: {
          id: true,
          documentNumber: true,
          clientId: true,
          clientName: true,
          clientDocument: true,
          invoicedAt: true,
        },
      },
    };
  }

  private serializeOrder(order: any) {
    const creditAmount = order.payments
      .filter((payment: any) => payment.method === OrderPaymentMethod.CREDIT)
      .reduce((sum: number, payment: any) => sum + decimalToNumber(payment.amount), 0);
    const collections = order.collections.map((collection: any) => ({ ...collection, amount: decimalToNumber(collection.amount) }));
    const collectedAmount = collections.reduce((sum: number, collection: any) => sum + collection.amount, 0);
    return {
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientDocument: order.clientDocument,
      documentNumber: order.documentNumber,
      pointOfSaleId: order.pointOfSaleId,
      pointOfSale: order.pointOfSale,
      createdAt: order.createdAt,
      invoicedAt: order.invoicedAt,
      totalAmount: decimalToNumber(order.totalAmount),
      creditAmount,
      collectedAmount,
      balanceDue: Math.max(0, creditAmount - collectedAmount),
      collections,
    };
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
