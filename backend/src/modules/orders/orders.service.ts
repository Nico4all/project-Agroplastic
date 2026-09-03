import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, OrderPaymentMethod, Prisma, RecordStatus, User } from '@prisma/client';
import { Workbook } from 'exceljs';
import { decimalToNumber } from '../../common/helpers/money';
import {
  buildOrderMovementsPdf,
  buildOrderTicketPdf,
  formatDate,
  OrderMovementReportSection,
} from '../../common/helpers/reports';
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

    const productIds = [...new Set(dto.items.map((item) => item.productId))];

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
    const requestedQuantityByProduct = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const currentQuantity = requestedQuantityByProduct.get(item.productId) || new Prisma.Decimal(0);
      requestedQuantityByProduct.set(item.productId, currentQuantity.add(item.quantity));
    }
    const totalAmount = items.reduce((total, item) => total.add(item.lineTotal), new Prisma.Decimal(0));
    if (new Set(dto.payments.map((payment) => payment.method)).size !== dto.payments.length) {
      throw new BadRequestException('No repitas la misma forma de pago');
    }
    const payments = dto.payments.map((payment) => ({
      method: payment.method,
      amount: new Prisma.Decimal(payment.amount),
    }));
    const paidTotal = payments.reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0));
    if (!paidTotal.equals(totalAmount)) {
      throw new BadRequestException(
        `La distribución de pagos debe ser igual al total del pedido (${totalAmount.toFixed(2)})`,
      );
    }

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
          paymentMethod: payments.length === 1 ? payments[0].method : null,
          observations: dto.observations?.trim() || null,
          totalAmount,
          status: RecordStatus.ACTIVE,
          inventoryAppliedAt: now,
          items: { create: items },
          payments: { create: payments },
        },
        include: this.includeRelations(),
      });

      for (const [productId, quantity] of requestedQuantityByProduct) {
        const productDescription = stocksByProduct.get(productId)!.product.description;
        const changed = await transaction.inventoryStock.updateMany({
          where: {
            pointOfSaleId: actor.pointOfSaleId!,
            productId,
            isActive: true,
            quantity: { gte: quantity },
          },
          data: { quantity: { decrement: quantity } },
        });
        if (changed.count !== 1) {
          throw new BadRequestException(`Inventario insuficiente para ${productDescription}`);
        }
        const stock = await transaction.inventoryStock.findUniqueOrThrow({
          where: { pointOfSaleId_productId: { pointOfSaleId: actor.pointOfSaleId!, productId } },
        });
        await transaction.inventoryMovement.create({
          data: {
            pointOfSaleId: actor.pointOfSaleId!,
            productId,
            userId: actor.id,
            orderId: created.id,
            type: InventoryMovementType.ORDER,
            quantityChange: quantity.negated(),
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
    if (current.collections.length) {
      throw new BadRequestException('No puedes anular un pedido que ya tiene recaudos de cartera activos');
    }

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
        const returnedQuantityByProduct = new Map<string, Prisma.Decimal>();
        for (const item of current.items) {
          const currentQuantity = returnedQuantityByProduct.get(item.productId) || new Prisma.Decimal(0);
          returnedQuantityByProduct.set(item.productId, currentQuantity.add(item.quantity));
        }
        for (const [productId, quantity] of returnedQuantityByProduct) {
          const stock = await tx.inventoryStock.update({
            where: {
              pointOfSaleId_productId: {
                pointOfSaleId: current.pointOfSaleId!,
                productId,
              },
            },
            data: { quantity: { increment: quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              pointOfSaleId: current.pointOfSaleId!,
              productId,
              userId: actor.id,
              orderId: current.id,
              type: InventoryMovementType.ORDER_VOID,
              quantityChange: quantity,
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
      paymentMethod: order.payments.length
        ? order.payments.map((payment: any) => `${this.paymentMethodLabel(payment.method)} ${this.formatMoney(decimalToNumber(payment.amount))}`).join(' / ')
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

  async exportMovementsPdf(userId: string, query: QueryOrdersDto) {
    const report = await this.getMovementReport(userId, query);
    const buffer = await buildOrderMovementsPdf(report.fromDate, report.toDate, report.sections);
    return {
      buffer,
      filename: `Movimientos pedidos - ${report.fromDate} a ${report.toDate}.pdf`,
    };
  }

  async exportMovementsExcel(userId: string, query: QueryOrdersDto) {
    const report = await this.getMovementReport(userId, query);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Movimientos', {
      views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
    });
    const generatedAt = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'America/Bogota',
    }).format(new Date());

    workbook.creator = 'AgroPlastick';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = `Movimientos de pedidos - ${report.fromDate} a ${report.toDate}`;
    workbook.subject = 'Movimientos de pedidos separados por efectivo, banco y credito';
    sheet.columns = [
      { key: 'orderNumber', width: 18 },
      { key: 'date', width: 15 },
      { key: 'clientDocument', width: 20 },
      { key: 'clientName', width: 46 },
      { key: 'pointOfSale', width: 26 },
      { key: 'amount', width: 20 },
    ];

    sheet.mergeCells('A1:F1');
    sheet.mergeCells('A2:F2');
    sheet.mergeCells('A3:F3');
    sheet.getCell('A1').value = 'MOVIMIENTOS DE PEDIDOS';
    sheet.getCell('A2').value = `De: ${report.fromDate}  A: ${report.toDate}`;
    sheet.getCell('A3').value = `Procesado: ${generatedAt}`;
    ['A1', 'A2'].forEach((address, index) => {
      const cell = sheet.getCell(address);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009846' } };
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: index === 0 ? 17 : 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.getCell('A3').font = { name: 'Arial', italic: true, color: { argb: 'FF5F6F65' }, size: 9 };
    sheet.getCell('A3').alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(1).height = 28;
    sheet.getRow(2).height = 22;
    sheet.getRow(3).height = 20;

    const summaryCards = [
      { label: 'MOVIMIENTOS', from: 1, to: 2 },
      { label: 'EFECTIVO', from: 3, to: 3 },
      { label: 'BANCO', from: 4, to: 4 },
      { label: 'CRÉDITO', from: 5, to: 6 },
    ];
    summaryCards.forEach(({ label, from, to }) => {
      if (from !== to) {
        sheet.mergeCells(5, from, 5, to);
        sheet.mergeCells(6, from, 6, to);
      }
      const labelCell = sheet.getCell(5, from);
      const valueCell = sheet.getCell(6, from);
      labelCell.value = label;
      [labelCell, valueCell].forEach((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF8F2' } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FF096B38' }, size: cell === valueCell ? 12 : 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.excelBorder();
      });
    });
    sheet.getRow(5).height = 20;
    sheet.getRow(6).height = 24;

    let rowNumber = 8;
    const sectionTotals = new Map<OrderPaymentMethod, { totalRow: number; countFormula: string; total: number }>();
    const methodByIndex = [OrderPaymentMethod.CASH, OrderPaymentMethod.BANK, OrderPaymentMethod.CREDIT];
    report.sections.forEach((section, sectionIndex) => {
      sheet.mergeCells(rowNumber, 1, rowNumber, 6);
      const sectionCell = sheet.getCell(rowNumber, 1);
      sectionCell.value = section.label.toLocaleUpperCase('es-CO');
      sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF096B38' } };
      sectionCell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
      sectionCell.border = this.excelBorder();
      sheet.getRow(rowNumber).height = 23;
      rowNumber += 1;

      const headerRow = sheet.getRow(rowNumber);
      headerRow.values = ['PEDIDO', 'FECHA', 'DOCUMENTO', 'CLIENTE', 'PUNTO DE VENTA', 'VALOR'];
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EEE2' } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FF096B38' }, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = this.excelBorder();
      });
      headerRow.height = 23;
      rowNumber += 1;

      const dataStartRow = rowNumber;
      section.rows.forEach((movement, index) => {
        const row = sheet.getRow(rowNumber);
        row.values = [
          movement.orderNumber,
          new Date(`${movement.date}T12:00:00`),
          movement.clientDocument,
          movement.clientName,
          movement.pointOfSale,
          movement.amount,
        ];
        row.font = { name: 'Arial', size: 10 };
        row.alignment = { vertical: 'middle' };
        row.height = movement.clientName.length > 38 ? 30 : 22;
        row.eachCell((cell) => {
          cell.border = this.excelBorder();
          if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBF9' } };
        });
        row.getCell(2).numFmt = 'yyyy-mm-dd';
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { vertical: 'middle', wrapText: true };
        row.getCell(6).numFmt = '$#,##0';
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        rowNumber += 1;
      });
      const dataEndRow = rowNumber - 1;

      if (!section.rows.length) {
        sheet.mergeCells(rowNumber, 1, rowNumber, 6);
        const emptyCell = sheet.getCell(rowNumber, 1);
        emptyCell.value = 'Sin movimientos en este periodo.';
        emptyCell.font = { name: 'Arial', italic: true, color: { argb: 'FF5F6F65' }, size: 10 };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        emptyCell.border = this.excelBorder();
        rowNumber += 1;
      }

      const totalRow = sheet.getRow(rowNumber);
      totalRow.getCell(1).value = `Total ${section.label}`;
      sheet.mergeCells(rowNumber, 1, rowNumber, 5);
      totalRow.getCell(6).value = section.rows.length
        ? { formula: `SUM(F${dataStartRow}:F${dataEndRow})`, result: section.total }
        : { formula: '0', result: 0 };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF8F2' } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FF096B38' }, size: 10 };
        cell.border = this.excelBorder();
      });
      totalRow.getCell(6).numFmt = '$#,##0';
      totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      sectionTotals.set(methodByIndex[sectionIndex], {
        totalRow: rowNumber,
        countFormula: section.rows.length ? `COUNTA(A${dataStartRow}:A${dataEndRow})` : '0',
        total: section.total,
      });
      rowNumber += 2;
    });

    const totalMovements = report.sections.reduce((sum, section) => sum + section.rows.length, 0);
    const countFormula = methodByIndex.map((method) => sectionTotals.get(method)?.countFormula || '0').join('+');
    sheet.getCell('A6').value = { formula: countFormula, result: totalMovements };
    sheet.getCell('A6').numFmt = '#,##0';
    [
      { address: 'C6', method: OrderPaymentMethod.CASH },
      { address: 'D6', method: OrderPaymentMethod.BANK },
      { address: 'E6', method: OrderPaymentMethod.CREDIT },
    ].forEach(({ address, method }) => {
      const summary = sectionTotals.get(method)!;
      const cell = sheet.getCell(address);
      cell.value = { formula: `F${summary.totalRow}`, result: summary.total };
      cell.numFmt = '$#,##0';
    });

    sheet.pageSetup.printArea = `A1:F${rowNumber - 1}`;
    sheet.headerFooter.oddFooter = 'Página &P de &N';
    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(output),
      filename: `Movimientos pedidos - ${report.fromDate} a ${report.toDate}.xlsx`,
    };
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
    if (query.fromDate) createdAt.gte = this.startOfDay(query.fromDate);
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
      payments: { orderBy: { createdAt: 'asc' as const } },
      collections: {
        select: { id: true, documentNumber: true, paymentMethod: true, amount: true, collectionDate: true, createdAt: true },
        orderBy: { collectionDate: 'asc' as const },
      },
    };
  }

  private serialize(order: any) {
    const payments = order.payments.map((payment: any) => ({ ...payment, amount: decimalToNumber(payment.amount) }));
    const collections = order.collections.map((collection: any) => ({ ...collection, amount: decimalToNumber(collection.amount) }));
    const creditAmount = payments
      .filter((payment: any) => payment.method === 'CREDIT')
      .reduce((total: number, payment: any) => total + payment.amount, 0);
    const collectedAmount = collections.reduce((total: number, collection: any) => total + collection.amount, 0);
    return {
      ...order,
      totalAmount: decimalToNumber(order.totalAmount),
      payments,
      collections,
      creditAmount,
      collectedAmount,
      balanceDue: order.status === RecordStatus.ACTIVE ? Math.max(0, creditAmount - collectedAmount) : 0,
      items: order.items.map((item: any) => ({
        ...item,
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        lineTotal: decimalToNumber(item.lineTotal),
      })),
    };
  }

  private paymentMethodLabel(value: string) {
    return value === 'CASH' ? 'Efectivo' : value === 'BANK' ? 'Banco' : 'Crédito';
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  }

  private endOfDay(value: string) {
    return new Date(`${value}T23:59:59.999-05:00`);
  }

  private startOfDay(value: string) {
    return new Date(`${value}T00:00:00.000-05:00`);
  }

  private async getMovementReport(userId: string, query: QueryOrdersDto) {
    const actor = await this.users.getActiveUser(userId);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const fromDate = query.fromDate || today;
    const toDate = query.toDate || fromDate;
    if (fromDate > toDate) throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final');

    const orders = await this.prisma.order.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        createdAt: { gte: this.startOfDay(fromDate), lte: this.endOfDay(toDate) },
        ...(!isAdminRole(actor.role) ? { pointOfSaleId: actor.pointOfSaleId! } : {}),
      },
      select: {
        documentNumber: true,
        clientName: true,
        clientDocument: true,
        createdAt: true,
        paymentMethod: true,
        totalAmount: true,
        pointOfSale: { select: { name: true } },
        payments: { select: { method: true, amount: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ createdAt: 'asc' }, { documentNumber: 'asc' }],
      take: 10000,
    });

    const definitions = [
      { method: OrderPaymentMethod.CASH, label: 'Efectivo' },
      { method: OrderPaymentMethod.BANK, label: 'Banco' },
      { method: OrderPaymentMethod.CREDIT, label: 'Crédito' },
    ];
    const sections: OrderMovementReportSection[] = definitions.map(({ method, label }) => {
      const rows = orders.flatMap((order) => {
        const payments = order.payments.length
          ? order.payments
          : order.paymentMethod
            ? [{ method: order.paymentMethod, amount: order.totalAmount }]
            : [];
        return payments
          .filter((payment) => payment.method === method)
          .map((payment) => ({
            orderNumber: order.documentNumber,
            date: this.formatBogotaDate(order.createdAt),
            clientDocument: order.clientDocument,
            clientName: order.clientName,
            pointOfSale: order.pointOfSale?.name || 'Sin punto de venta',
            amount: decimalToNumber(payment.amount),
          }));
      });
      return {
        label,
        rows,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
      };
    });

    return { fromDate, toDate, sections };
  }

  private formatBogotaDate(value: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private excelBorder() {
    const border = { style: 'thin' as const, color: { argb: 'FFD9E3DC' } };
    return { top: border, left: border, bottom: border, right: border };
  }
}
