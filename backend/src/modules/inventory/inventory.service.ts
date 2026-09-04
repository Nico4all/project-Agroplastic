import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma, RecordStatus, User } from '@prisma/client';
import { Workbook } from 'exceljs';
import { decimalToNumber } from '../../common/helpers/money';
import { cleanDisplayText } from '../../common/helpers/normalization';
import { buildListPdf, formatDate } from '../../common/helpers/reports';
import { isAdminRole } from '../../common/helpers/roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateInventoryAdjustmentDto, InventoryAdjustmentOperation } from './dto/create-inventory-adjustment.dto';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { CreateInventoryTransferDto } from './dto/create-inventory-transfer.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryProductHistoryDto } from './dto/query-product-history.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { VoidInventoryAdjustmentDto } from './dto/void-inventory-adjustment.dto';

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

  async exportStocksExcel(userId: string, query: QueryInventoryDto) {
    const report = await this.getStockReport(userId, query);
    const workbook = new Workbook();
    const generatedAt = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date());
    const sheet = workbook.addWorksheet('Existencias', {
      views: [{ state: 'frozen', ySplit: 7 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    workbook.creator = 'AgroPlastick';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = `Existencias de inventario de ${report.point.name}`;
    workbook.title = `Inventario - ${report.point.name}`;
    sheet.columns = [
      { key: 'product', width: 58 },
      { key: 'quantity', width: 20 },
      { key: 'status', width: 18 },
      { key: 'updatedAt', width: 24 },
    ];

    sheet.mergeCells('A1:D1');
    sheet.mergeCells('A2:D2');
    sheet.mergeCells('A3:D3');
    sheet.getCell('A1').value = 'REPORTE DE EXISTENCIAS DE INVENTARIO';
    sheet.getCell('A2').value = report.point.name.toLocaleUpperCase('es-CO');
    sheet.getCell('A3').value = `Generado: ${generatedAt}`;
    ['A1', 'A2'].forEach((cell) => {
      sheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009846' } };
      sheet.getCell(cell).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: cell === 'A1' ? 16 : 13 };
      sheet.getCell(cell).alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.getCell('A3').font = { name: 'Arial', italic: true, color: { argb: 'FF5F6F65' }, size: 9 };
    sheet.getCell('A3').alignment = { horizontal: 'right' };
    sheet.getRow(1).height = 27;
    sheet.getRow(2).height = 23;

    const summary = [
      ['REFERENCIAS', report.rows.length],
      ['UNIDADES DISPONIBLES', report.totalUnits],
      ['SIN EXISTENCIA', report.outOfStock],
      ['INACTIVOS', report.inactive],
    ];
    summary.forEach(([label, value], index) => {
      const cell = sheet.getCell(5, index + 1);
      cell.value = `${label}\n${this.formatQuantity(Number(value))}`;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF8F2' } };
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FF096B38' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.excelBorder();
    });
    sheet.getRow(5).height = 38;

    sheet.getRow(7).values = ['PRODUCTO', 'EXISTENCIA', 'ESTADO', 'ÚLTIMA ACTUALIZACIÓN'];
    sheet.getRow(7).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF096B38' } };
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.excelBorder();
    });
    sheet.getRow(7).height = 26;

    report.rows.forEach((stock, index) => {
      const row = sheet.addRow({
        product: stock.productDescription,
        quantity: stock.quantity,
        status: stock.isActive ? 'Activo' : 'Inactivo',
        updatedAt: formatDate(stock.updatedAt),
      });
      row.font = { name: 'Arial', size: 10 };
      row.alignment = { vertical: 'middle' };
      row.eachCell((cell) => {
        cell.border = this.excelBorder();
        if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBF9' } };
      });
      row.getCell(2).numFmt = '#,##0.###';
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      if (stock.quantity <= 0) row.getCell(2).font = { name: 'Arial', bold: true, color: { argb: 'FFB42318' } };
    });
    sheet.autoFilter = { from: 'A7', to: `D${Math.max(7, 7 + report.rows.length)}` };

    const output = await workbook.xlsx.writeBuffer();
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    return {
      buffer: Buffer.from(output),
      filename: `Existencias - ${this.safeFilename(report.point.name)} - ${date}.xlsx`,
    };
  }

  async exportStocksPdf(userId: string, query: QueryInventoryDto) {
    const report = await this.getStockReport(userId, query);
    const buffer = await buildListPdf(
      `Existencias de inventario - ${report.point.name}`,
      [
        { label: 'Referencias', value: this.formatQuantity(report.rows.length) },
        { label: 'Unidades disponibles', value: this.formatQuantity(report.totalUnits) },
        { label: 'Sin existencia', value: this.formatQuantity(report.outOfStock) },
        { label: 'Inactivos', value: this.formatQuantity(report.inactive) },
      ],
      [
        { label: 'PRODUCTO', width: 420 },
        { label: 'EXISTENCIA', width: 110, align: 'right' },
        { label: 'ESTADO', width: 100, align: 'center' },
        { label: 'ACTUALIZADO', width: 140, align: 'center' },
      ],
      report.rows.map((stock) => [
        stock.productDescription,
        this.formatQuantity(stock.quantity),
        stock.isActive ? 'Activo' : 'Inactivo',
        formatDate(stock.updatedAt),
      ]),
    );
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    return {
      buffer,
      filename: `Existencias - ${this.safeFilename(report.point.name)} - ${date}.pdf`,
    };
  }

  async findEntries(userId: string, query: QueryInventoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const entryDate: Prisma.DateTimeFilter = {};
    if (query.fromDate) entryDate.gte = this.startOfDay(query.fromDate);
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

  async findAdjustments(userId: string, query: QueryInventoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const adjustmentDate: Prisma.DateTimeFilter = {};
    if (query.fromDate) adjustmentDate.gte = this.startOfDay(query.fromDate);
    if (query.toDate) adjustmentDate.lte = this.endOfDay(query.toDate);
    const where: Prisma.InventoryAdjustmentWhereInput = {
      pointOfSaleId,
      ...(Object.keys(adjustmentDate).length ? { adjustmentDate } : {}),
      ...(query.search ? {
        OR: [
          { documentNumber: { contains: query.search } },
          { observation: { contains: query.search } },
          { product: { description: { contains: query.search } } },
        ],
      } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryAdjustment.count({ where }),
      this.prisma.inventoryAdjustment.findMany({
        where,
        include: this.adjustmentRelations(),
        orderBy: { adjustmentDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data: rows.map((row) => this.serializeAdjustment(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async findTransfers(userId: string, query: QueryInventoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const transferDate: Prisma.DateTimeFilter = {};
    if (query.fromDate) transferDate.gte = this.startOfDay(query.fromDate);
    if (query.toDate) transferDate.lte = this.endOfDay(query.toDate);
    const where: Prisma.InventoryTransferWhereInput = {
      OR: [{ originPointOfSaleId: pointOfSaleId }, { destinationPointOfSaleId: pointOfSaleId }],
      ...(Object.keys(transferDate).length ? { transferDate } : {}),
      ...(query.search ? {
        AND: [{
          OR: [
            { documentNumber: { contains: query.search } },
            { observation: { contains: query.search } },
            { product: { description: { contains: query.search } } },
            { originPointOfSale: { name: { contains: query.search } } },
            { destinationPointOfSale: { name: { contains: query.search } } },
          ],
        }],
      } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryTransfer.count({ where }),
      this.prisma.inventoryTransfer.findMany({
        where,
        include: this.transferRelations(),
        orderBy: { transferDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data: rows.map((row) => this.serializeTransfer(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async findProductHistory(userId: string, query: QueryProductHistoryDto) {
    const context = await this.productHistoryContext(userId, query);
    const [total, rows, stats, inputTotal, outputTotal] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where: context.where }),
      this.prisma.inventoryMovement.findMany({
        where: context.where,
        include: this.productHistoryRelations(),
        orderBy: { createdAt: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryMovement.groupBy({
        by: ['type'],
        where: context.where,
        orderBy: { type: 'asc' },
        _count: { _all: true },
        _sum: { quantityChange: true },
      }),
      this.prisma.inventoryMovement.aggregate({
        where: { AND: [context.where, { quantityChange: { gt: 0 } }] },
        _sum: { quantityChange: true },
      }),
      this.prisma.inventoryMovement.aggregate({
        where: { AND: [context.where, { quantityChange: { lt: 0 } }] },
        _sum: { quantityChange: true },
      }),
    ]);
    const summary = this.productHistorySummary(
      stats,
      total,
      decimalToNumber(context.stock.quantity),
      decimalToNumber(inputTotal._sum.quantityChange),
      Math.abs(decimalToNumber(outputTotal._sum.quantityChange)),
    );
    return {
      data: rows.map((row) => this.serializeProductHistory(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary,
      product: { id: context.stock.product.id, description: context.stock.product.description },
      pointOfSale: context.stock.pointOfSale,
    };
  }

  async exportProductHistoryExcel(userId: string, query: QueryProductHistoryDto) {
    const context = await this.productHistoryContext(userId, query);
    const rows = await this.prisma.inventoryMovement.findMany({
      where: context.where,
      include: this.productHistoryRelations(),
      orderBy: { createdAt: query.sort },
    });
    const serialized = rows.map((row) => this.serializeProductHistory(row));
    const totalInput = serialized.reduce((sum, row) => sum + row.quantityInput, 0);
    const totalOutput = serialized.reduce((sum, row) => sum + row.quantityOutput, 0);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Histórico', {
      views: [{ state: 'frozen', ySplit: 8 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const generatedAt = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date());
    workbook.creator = 'AgroPlastick';
    workbook.created = new Date();
    workbook.title = `Histórico de ${context.stock.product.description}`;
    workbook.subject = `Entradas y salidas por pedidos en ${context.stock.pointOfSale.name}`;
    sheet.columns = [
      { key: 'date', width: 17 },
      { key: 'type', width: 15 },
      { key: 'document', width: 19 },
      { key: 'thirdParty', width: 34 },
      { key: 'before', width: 20 },
      { key: 'input', width: 17 },
      { key: 'output', width: 18 },
      { key: 'after', width: 20 },
      { key: 'detail', width: 26 },
      { key: 'user', width: 24 },
    ];
    sheet.mergeCells('A1:J1');
    sheet.mergeCells('A2:J2');
    sheet.mergeCells('A3:J3');
    sheet.mergeCells('A4:J4');
    sheet.getCell('A1').value = 'HISTÓRICO DE MOVIMIENTOS POR PRODUCTO';
    sheet.getCell('A2').value = context.stock.product.description.toLocaleUpperCase('es-CO');
    sheet.getCell('A3').value = `Bodega: ${context.stock.pointOfSale.name}`;
    sheet.getCell('A4').value = `Periodo: ${query.fromDate || 'Inicio'} a ${query.toDate || 'Hoy'} · Generado: ${generatedAt}`;
    ['A1', 'A2', 'A3'].forEach((address, index) => {
      const cell = sheet.getCell(address);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index < 2 ? 'FF009846' : 'FFEDF8F2' } };
      cell.font = { name: 'Arial', bold: true, color: { argb: index < 2 ? 'FFFFFFFF' : 'FF096B38' }, size: index === 0 ? 16 : index === 1 ? 13 : 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.getCell('A4').font = { name: 'Arial', italic: true, color: { argb: 'FF5F6F65' }, size: 9 };
    sheet.getCell('A4').alignment = { horizontal: 'right' };
    const summary = [
      { label: 'MOVIMIENTOS', value: serialized.length, start: 1, end: 2 },
      { label: 'TOTAL ENTRADA', value: totalInput, start: 3, end: 5 },
      { label: 'TOTAL SALIDA', value: totalOutput, start: 6, end: 8 },
      { label: 'INVENTARIO ACTUAL', value: decimalToNumber(context.stock.quantity), start: 9, end: 10 },
    ];
    summary.forEach(({ label, value, start, end }) => {
      sheet.mergeCells(6, start, 6, end);
      const cell = sheet.getCell(6, start);
      cell.value = `${label}\n${this.formatQuantity(Number(value))}`;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF8F2' } };
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FF096B38' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.excelBorder();
    });
    sheet.getRow(6).height = 38;
    sheet.getRow(8).values = ['FECHA', 'TIPO', 'DOCUMENTO', 'TERCERO / BODEGA', 'INVENTARIO ANTES', 'ENTRADA', 'SALIDA', 'INVENTARIO DESPUÉS', 'DETALLE', 'USUARIO'];
    sheet.getRow(8).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF096B38' } };
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.excelBorder();
    });
    sheet.getRow(8).height = 28;
    serialized.forEach((movement, index) => {
      const row = sheet.addRow({
        date: formatDate(movement.date),
        type: this.productHistoryMovementLabel(movement.movementType),
        document: movement.documentNumber,
        thirdParty: [movement.thirdPartyName, movement.thirdPartyDocument].filter(Boolean).join(' · '),
        before: movement.inventoryBefore,
        input: movement.quantityInput || null,
        output: movement.quantityOutput || null,
        after: movement.inventoryAfter,
        detail: movement.detail,
        user: movement.userName,
      });
      row.font = { name: 'Arial', size: 10 };
      row.eachCell((cell) => {
        cell.border = this.excelBorder();
        if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBF9' } };
      });
      [5, 6, 7, 8].forEach((column) => {
        row.getCell(column).numFmt = '#,##0.###';
        row.getCell(column).alignment = { horizontal: 'right', vertical: 'middle' };
      });
    });
    sheet.autoFilter = { from: 'A8', to: `J${Math.max(8, 8 + serialized.length)}` };
    const output = await workbook.xlsx.writeBuffer();
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    return {
      buffer: Buffer.from(output),
      filename: `Histórico movimientos - ${this.safeFilename(context.stock.product.description)} - ${this.safeFilename(context.stock.pointOfSale.name)} - ${date}.xlsx`,
    };
  }

  async createEntry(userId: string, dto: CreateInventoryEntryDto) {
    const actor = await this.users.ensureAdmin(userId);
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

  async adjustStock(userId: string, dto: CreateInventoryAdjustmentDto) {
    const actor = await this.users.ensureAdmin(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, dto.pointOfSaleId);
    const quantity = new Prisma.Decimal(dto.quantity);
    const isAddition = dto.operation === InventoryAdjustmentOperation.ADD;

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const numberedPoint = await tx.pointOfSale.update({
        where: { id: pointOfSaleId },
        data: { nextInventoryAdjustmentNumber: { increment: 1 } },
        select: { documentPrefix: true, nextInventoryAdjustmentNumber: true, isActive: true },
      });
      if (!numberedPoint.isActive) throw new BadRequestException('La bodega está inactiva');
      const documentSequence = numberedPoint.nextInventoryAdjustmentNumber - 1;
      const changed = await tx.inventoryStock.updateMany({
        where: {
          pointOfSaleId,
          productId: dto.productId,
          isActive: true,
          ...(!isAddition ? { quantity: { gte: quantity } } : {}),
        },
        data: isAddition ? { quantity: { increment: quantity } } : { quantity: { decrement: quantity } },
      });

      if (changed.count !== 1) {
        const current = await tx.inventoryStock.findUnique({
          where: { pointOfSaleId_productId: { pointOfSaleId, productId: dto.productId } },
          include: { product: { select: { description: true } } },
        });
        if (!current || !current.isActive) {
          throw new BadRequestException('El producto no pertenece a esta bodega o está inactivo');
        }
        throw new BadRequestException(
          `Inventario insuficiente para ${current.product.description}. Existencia actual: ${this.formatQuantity(decimalToNumber(current.quantity))}`,
        );
      }

      const stock = await tx.inventoryStock.findUniqueOrThrow({
        where: { pointOfSaleId_productId: { pointOfSaleId, productId: dto.productId } },
        include: {
          product: { select: { description: true } },
          pointOfSale: { select: { id: true, name: true } },
        },
      });
      const quantityChange = isAddition ? quantity : quantity.negated();
      const created = await tx.inventoryAdjustment.create({
        data: {
          userId: actor.id,
          pointOfSaleId,
          productId: dto.productId,
          documentSequence,
          documentNumber: `${numberedPoint.documentPrefix}-AI-${documentSequence}`,
          operation: dto.operation,
          quantity,
          balanceBefore: stock.quantity.minus(quantityChange),
          balanceAfter: stock.quantity,
          observation: dto.observation?.trim() || null,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          pointOfSaleId,
          productId: dto.productId,
          userId: actor.id,
          inventoryAdjustmentId: created.id,
          type: isAddition ? InventoryMovementType.ADJUSTMENT_ADD : InventoryMovementType.ADJUSTMENT_SUBTRACT,
          quantityChange,
          balanceAfter: stock.quantity,
        },
      });
      return tx.inventoryAdjustment.findUniqueOrThrow({ where: { id: created.id }, include: this.adjustmentRelations() });
    });

    return this.serializeAdjustment(adjustment);
  }

  async updateAdjustment(userId: string, id: string, dto: UpdateInventoryAdjustmentDto) {
    const actor = await this.users.ensureAdmin(userId);
    const quantity = new Prisma.Decimal(dto.quantity);
    const adjustment = await this.prisma.$transaction(async (tx) => {
      await this.lockInventoryAdjustment(tx, id);
      const current = await tx.inventoryAdjustment.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Ajuste de inventario no encontrado');
      if (current.status === RecordStatus.VOID) throw new BadRequestException('No puedes editar un ajuste anulado');

      const movementTotal = await tx.inventoryMovement.aggregate({
        where: { inventoryAdjustmentId: id },
        _sum: { quantityChange: true },
      });
      const appliedQuantity = movementTotal._sum.quantityChange || new Prisma.Decimal(0);
      const targetQuantity = current.operation === InventoryAdjustmentOperation.ADD ? quantity : quantity.negated();
      const difference = targetQuantity.minus(appliedQuantity);
      const claimed = await tx.inventoryAdjustment.updateMany({
        where: { id, status: RecordStatus.ACTIVE, quantity: current.quantity },
        data: {
          quantity,
          balanceAfter: current.balanceBefore.add(targetQuantity),
          observation: dto.observation?.trim() || null,
        },
      });
      if (claimed.count !== 1) throw new BadRequestException('El ajuste cambió mientras lo editabas. Intenta de nuevo');

      if (!difference.isZero()) {
        const stock = await this.applyInventoryDelta(
          tx,
          current.pointOfSaleId,
          current.productId,
          difference,
          'editar el ajuste',
        );
        await tx.inventoryMovement.create({
          data: {
            pointOfSaleId: current.pointOfSaleId,
            productId: current.productId,
            userId: actor.id,
            inventoryAdjustmentId: current.id,
            type: InventoryMovementType.ADJUSTMENT_EDIT,
            quantityChange: difference,
            balanceAfter: stock.quantity,
          },
        });
      }

      return tx.inventoryAdjustment.findUniqueOrThrow({ where: { id }, include: this.adjustmentRelations() });
    });
    return this.serializeAdjustment(adjustment);
  }

  async voidAdjustment(userId: string, id: string, dto: VoidInventoryAdjustmentDto) {
    const actor = await this.users.ensureAdmin(userId);
    const adjustment = await this.prisma.$transaction(async (tx) => {
      await this.lockInventoryAdjustment(tx, id);
      const current = await tx.inventoryAdjustment.findUnique({
        where: { id },
        include: this.adjustmentRelations(),
      });
      if (!current) throw new NotFoundException('Ajuste de inventario no encontrado');
      if (current.status === RecordStatus.VOID) return current;

      const movementTotal = await tx.inventoryMovement.aggregate({
        where: { inventoryAdjustmentId: id },
        _sum: { quantityChange: true },
      });
      const appliedQuantity = movementTotal._sum.quantityChange || new Prisma.Decimal(0);
      const claimed = await tx.inventoryAdjustment.updateMany({
        where: { id, status: RecordStatus.ACTIVE },
        data: {
          status: RecordStatus.VOID,
          voidReason: dto.reason?.trim() || null,
          voidedAt: new Date(),
          voidedByUserId: actor.id,
        },
      });
      if (claimed.count !== 1) throw new BadRequestException('El ajuste ya fue anulado');

      const reversal = appliedQuantity.negated();
      if (!reversal.isZero()) {
        const stock = await this.applyInventoryDelta(
          tx,
          current.pointOfSaleId,
          current.productId,
          reversal,
          'anular el ajuste',
        );
        await tx.inventoryMovement.create({
          data: {
            pointOfSaleId: current.pointOfSaleId,
            productId: current.productId,
            userId: actor.id,
            inventoryAdjustmentId: current.id,
            type: InventoryMovementType.ADJUSTMENT_VOID,
            quantityChange: reversal,
            balanceAfter: stock.quantity,
          },
        });
      }

      return tx.inventoryAdjustment.findUniqueOrThrow({ where: { id }, include: this.adjustmentRelations() });
    });
    return this.serializeAdjustment(adjustment);
  }

  async transferStock(userId: string, dto: CreateInventoryTransferDto) {
    const actor = await this.users.ensureAdmin(userId);
    const originPointOfSaleId = await this.resolvePointOfSale(actor, dto.originPointOfSaleId);
    const destinationPointOfSaleId = await this.resolvePointOfSale(actor, dto.destinationPointOfSaleId);
    if (originPointOfSaleId === destinationPointOfSaleId) {
      throw new BadRequestException('La bodega de origen y destino deben ser diferentes');
    }
    const quantity = new Prisma.Decimal(dto.quantity);

    const transfer = await this.prisma.$transaction(async (tx) => {
      const numberedOrigin = await tx.pointOfSale.update({
        where: { id: originPointOfSaleId },
        data: { nextInventoryTransferNumber: { increment: 1 } },
        select: { documentPrefix: true, nextInventoryTransferNumber: true, isActive: true },
      });
      if (!numberedOrigin.isActive) throw new BadRequestException('La bodega de origen está inactiva');
      const documentSequence = numberedOrigin.nextInventoryTransferNumber - 1;

      const originChanged = await tx.inventoryStock.updateMany({
        where: { pointOfSaleId: originPointOfSaleId, productId: dto.productId, isActive: true, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (originChanged.count !== 1) {
        const current = await tx.inventoryStock.findUnique({
          where: { pointOfSaleId_productId: { pointOfSaleId: originPointOfSaleId, productId: dto.productId } },
          include: { product: { select: { description: true } } },
        });
        if (!current || !current.isActive) throw new BadRequestException('El producto no está activo en la bodega de origen');
        throw new BadRequestException(
          `Inventario insuficiente para ${current.product.description}. Existencia actual: ${this.formatQuantity(decimalToNumber(current.quantity))}`,
        );
      }

      const destinationChanged = await tx.inventoryStock.updateMany({
        where: { pointOfSaleId: destinationPointOfSaleId, productId: dto.productId, isActive: true },
        data: { quantity: { increment: quantity } },
      });
      if (destinationChanged.count !== 1) {
        throw new BadRequestException('El producto no está activo en la bodega de destino');
      }

      const [originStock, destinationStock] = await Promise.all([
        tx.inventoryStock.findUniqueOrThrow({
          where: { pointOfSaleId_productId: { pointOfSaleId: originPointOfSaleId, productId: dto.productId } },
          include: { product: { select: { description: true } } },
        }),
        tx.inventoryStock.findUniqueOrThrow({
          where: { pointOfSaleId_productId: { pointOfSaleId: destinationPointOfSaleId, productId: dto.productId } },
        }),
      ]);
      const created = await tx.inventoryTransfer.create({
        data: {
          userId: actor.id,
          originPointOfSaleId,
          destinationPointOfSaleId,
          productId: dto.productId,
          documentSequence,
          documentNumber: `${numberedOrigin.documentPrefix}-TI-${documentSequence}`,
          quantity,
          originBalanceBefore: originStock.quantity.plus(quantity),
          originBalanceAfter: originStock.quantity,
          destinationBalanceBefore: destinationStock.quantity.minus(quantity),
          destinationBalanceAfter: destinationStock.quantity,
          observation: dto.observation?.trim() || null,
        },
      });
      await tx.inventoryMovement.createMany({
        data: [
          {
            pointOfSaleId: originPointOfSaleId,
            productId: dto.productId,
            userId: actor.id,
            inventoryTransferId: created.id,
            type: InventoryMovementType.TRANSFER_OUT,
            quantityChange: quantity.negated(),
            balanceAfter: originStock.quantity,
          },
          {
            pointOfSaleId: destinationPointOfSaleId,
            productId: dto.productId,
            userId: actor.id,
            inventoryTransferId: created.id,
            type: InventoryMovementType.TRANSFER_IN,
            quantityChange: quantity,
            balanceAfter: destinationStock.quantity,
          },
        ],
      });
      return tx.inventoryTransfer.findUniqueOrThrow({ where: { id: created.id }, include: this.transferRelations() });
    });

    return this.serializeTransfer(transfer);
  }

  private async resolvePointOfSale(actor: User, requested?: string) {
    const pointOfSaleId = isAdminRole(actor.role) ? requested || actor.pointOfSaleId : actor.pointOfSaleId;
    if (!pointOfSaleId) throw new BadRequestException('Selecciona un punto de venta');
    const point = await this.prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
    if (!point || !point.isActive) throw new BadRequestException('El punto de venta no existe o esta inactivo');
    return pointOfSaleId;
  }

  private async productHistoryContext(userId: string, query: QueryProductHistoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const stock = await this.prisma.inventoryStock.findUnique({
      where: { pointOfSaleId_productId: { pointOfSaleId, productId: query.productId } },
      include: {
        product: { select: { id: true, description: true } },
        pointOfSale: { select: { id: true, name: true, code: true } },
      },
    });
    if (!stock) throw new NotFoundException('Producto no encontrado en esta bodega');
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.fromDate) createdAt.gte = this.startOfDay(query.fromDate);
    if (query.toDate) createdAt.lte = this.endOfDay(query.toDate);
    const where: Prisma.InventoryMovementWhereInput = {
      pointOfSaleId,
      productId: query.productId,
      OR: [
        { type: InventoryMovementType.ORDER, orderId: { not: null } },
        { type: InventoryMovementType.ORDER_VOID, orderId: { not: null } },
        { type: InventoryMovementType.ENTRY, inventoryEntryId: { not: null } },
        {
          type: {
            in: [
              InventoryMovementType.ADJUSTMENT_ADD,
              InventoryMovementType.ADJUSTMENT_SUBTRACT,
              InventoryMovementType.ADJUSTMENT_EDIT,
              InventoryMovementType.ADJUSTMENT_VOID,
            ],
          },
          inventoryAdjustmentId: { not: null },
        },
        { type: { in: [InventoryMovementType.TRANSFER_IN, InventoryMovementType.TRANSFER_OUT] }, inventoryTransferId: { not: null } },
      ],
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
    return { stock, where };
  }

  private productHistoryRelations() {
    return {
      order: {
        select: {
          id: true,
          documentNumber: true,
          clientName: true,
          clientDocument: true,
          status: true,
          invoicedAt: true,
        },
      },
      inventoryEntry: {
        select: {
          id: true,
          documentNumber: true,
          supplierName: true,
          remittanceNumber: true,
        },
      },
      inventoryAdjustment: {
        select: {
          id: true,
          documentNumber: true,
          operation: true,
          observation: true,
          status: true,
          voidReason: true,
        },
      },
      inventoryTransfer: {
        select: {
          id: true,
          documentNumber: true,
          observation: true,
          originPointOfSale: { select: { id: true, name: true } },
          destinationPointOfSale: { select: { id: true, name: true } },
        },
      },
      user: { select: { id: true, name: true, username: true } },
    };
  }

  private serializeProductHistory(row: any) {
    const quantityChange = decimalToNumber(row.quantityChange);
    const inventoryAfter = decimalToNumber(row.balanceAfter);
    const isEntry = row.type === InventoryMovementType.ENTRY;
    const isOrder = row.type === InventoryMovementType.ORDER || row.type === InventoryMovementType.ORDER_VOID;
    const isAdjustment = [
      InventoryMovementType.ADJUSTMENT_ADD,
      InventoryMovementType.ADJUSTMENT_SUBTRACT,
      InventoryMovementType.ADJUSTMENT_EDIT,
      InventoryMovementType.ADJUSTMENT_VOID,
    ].includes(row.type);
    const document = isEntry ? row.inventoryEntry : isOrder ? row.order : isAdjustment ? row.inventoryAdjustment : row.inventoryTransfer;
    const thirdPartyName = isEntry
      ? document.supplierName
      : isOrder
        ? document.clientName
        : isAdjustment
          ? 'Ajuste interno'
          : row.type === InventoryMovementType.TRANSFER_IN
            ? document.originPointOfSale.name
            : document.destinationPointOfSale.name;
    const detail = isEntry
      ? document.remittanceNumber ? `Remisión ${document.remittanceNumber}` : 'Entrada aplicada'
      : isOrder
        ? row.type === InventoryMovementType.ORDER_VOID
          ? `Reintegro por anulación · ${document.documentNumber}`
          : `${document.status === 'VOID' ? 'Anulado' : 'Activo'} · ${document.invoicedAt ? 'Facturado' : 'Sin facturar'}`
        : isAdjustment
          ? row.type === InventoryMovementType.ADJUSTMENT_EDIT
            ? `Corrección de cantidad · ${document.observation || 'Sin observación'}`
            : row.type === InventoryMovementType.ADJUSTMENT_VOID
              ? `Reversión por anulación · ${document.voidReason || 'Sin motivo'}`
              : `${document.status === RecordStatus.VOID ? 'Ajuste anulado' : document.operation === 'ADD' ? 'Suma' : 'Resta'} · ${document.observation || 'Sin observación'}`
          : `${document.originPointOfSale.name} → ${document.destinationPointOfSale.name}${document.observation ? ` · ${document.observation}` : ''}`;
    return {
      id: row.id,
      date: row.createdAt,
      movementType: row.type,
      documentId: document.id,
      documentNumber: document.documentNumber,
      thirdPartyName,
      thirdPartyDocument: isOrder ? document.clientDocument : null,
      quantityInput: quantityChange > 0 ? quantityChange : 0,
      quantityOutput: quantityChange < 0 ? Math.abs(quantityChange) : 0,
      inventoryBefore: inventoryAfter - quantityChange,
      inventoryAfter,
      detail,
      orderStatus: isOrder ? document.status : null,
      invoicedAt: isOrder ? document.invoicedAt : null,
      userName: row.user.name,
    };
  }

  private productHistorySummary(
    stats: any[],
    movements: number,
    currentInventory: number,
    totalInput: number,
    totalOutput: number,
  ) {
    const byType = new Map(stats.map((row) => [row.type, row]));
    const entries = byType.get(InventoryMovementType.ENTRY);
    const orders = byType.get(InventoryMovementType.ORDER);
    const adjustmentAdd = byType.get(InventoryMovementType.ADJUSTMENT_ADD);
    const adjustmentSubtract = byType.get(InventoryMovementType.ADJUSTMENT_SUBTRACT);
    const adjustmentEdit = byType.get(InventoryMovementType.ADJUSTMENT_EDIT);
    const adjustmentVoid = byType.get(InventoryMovementType.ADJUSTMENT_VOID);
    const transferIn = byType.get(InventoryMovementType.TRANSFER_IN);
    const transferOut = byType.get(InventoryMovementType.TRANSFER_OUT);
    const count = (row: any) => row?._count?._all || 0;
    return {
      movements,
      entries: count(entries),
      orders: count(orders),
      adjustments: count(adjustmentAdd) + count(adjustmentSubtract) + count(adjustmentEdit) + count(adjustmentVoid),
      transfers: count(transferIn) + count(transferOut),
      totalInput,
      totalOutput,
      currentInventory,
    };
  }

  private productHistoryMovementLabel(type: InventoryMovementType) {
    const labels: Record<InventoryMovementType, string> = {
      [InventoryMovementType.ENTRY]: 'Entrada',
      [InventoryMovementType.ORDER]: 'Pedido',
      [InventoryMovementType.ORDER_VOID]: 'Anulación',
      [InventoryMovementType.ADJUSTMENT_ADD]: 'Ajuste +',
      [InventoryMovementType.ADJUSTMENT_SUBTRACT]: 'Ajuste -',
      [InventoryMovementType.ADJUSTMENT_EDIT]: 'Edición de ajuste',
      [InventoryMovementType.ADJUSTMENT_VOID]: 'Anulación de ajuste',
      [InventoryMovementType.TRANSFER_IN]: 'Traslado entrada',
      [InventoryMovementType.TRANSFER_OUT]: 'Traslado salida',
    };
    return labels[type];
  }

  private async getStockReport(userId: string, query: QueryInventoryDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const point = await this.prisma.pointOfSale.findUniqueOrThrow({
      where: { id: pointOfSaleId },
      select: { id: true, name: true, code: true },
    });
    const rows = await this.prisma.inventoryStock.findMany({
      where: { pointOfSaleId },
      include: { product: { select: { description: true } } },
      orderBy: { product: { description: 'asc' } },
    });
    const serialized = rows.map((row) => ({
      productDescription: row.product.description,
      quantity: decimalToNumber(row.quantity),
      isActive: Boolean(row.isActive),
      updatedAt: row.updatedAt,
    }));
    return {
      point,
      rows: serialized,
      totalUnits: serialized.reduce((total, row) => total + row.quantity, 0),
      outOfStock: serialized.filter((row) => row.isActive && row.quantity <= 0).length,
      inactive: serialized.filter((row) => !row.isActive).length,
    };
  }

  private formatQuantity(value: number) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(value);
  }

  private safeFilename(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, '-').trim();
  }

  private excelBorder() {
    const side = { style: 'thin' as const, color: { argb: 'FFCfd9d2'.toUpperCase() } };
    return { top: side, left: side, bottom: side, right: side };
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

  private adjustmentRelations() {
    return {
      user: { select: { id: true, name: true, username: true } },
      voidedBy: { select: { id: true, name: true, username: true } },
      pointOfSale: { select: { id: true, name: true, code: true } },
      product: { select: { id: true, description: true } },
    };
  }

  private serializeAdjustment(row: any) {
    return {
      ...row,
      quantity: decimalToNumber(row.quantity),
      balanceBefore: decimalToNumber(row.balanceBefore),
      balanceAfter: decimalToNumber(row.balanceAfter),
    };
  }

  private async applyInventoryDelta(
    tx: Prisma.TransactionClient,
    pointOfSaleId: string,
    productId: string,
    delta: Prisma.Decimal,
    action: string,
  ) {
    if (delta.isZero()) {
      return tx.inventoryStock.findUniqueOrThrow({
        where: { pointOfSaleId_productId: { pointOfSaleId, productId } },
      });
    }
    const decreasesStock = delta.isNegative();
    const amount = delta.abs();
    const changed = await tx.inventoryStock.updateMany({
      where: {
        pointOfSaleId,
        productId,
        ...(decreasesStock ? { quantity: { gte: amount } } : {}),
      },
      data: decreasesStock ? { quantity: { decrement: amount } } : { quantity: { increment: amount } },
    });
    if (changed.count !== 1) {
      const stock = await tx.inventoryStock.findUnique({
        where: { pointOfSaleId_productId: { pointOfSaleId, productId } },
        include: { product: { select: { description: true } } },
      });
      if (!stock) throw new BadRequestException('El producto no pertenece a esta bodega');
      throw new BadRequestException(
        `No hay inventario suficiente para ${action} de ${stock.product.description}. Existencia actual: ${this.formatQuantity(decimalToNumber(stock.quantity))}`,
      );
    }
    return tx.inventoryStock.findUniqueOrThrow({
      where: { pointOfSaleId_productId: { pointOfSaleId, productId } },
    });
  }

  private async lockInventoryAdjustment(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM inventory_adjustments WHERE id = ${id} FOR UPDATE`;
  }

  private transferRelations() {
    return {
      user: { select: { id: true, name: true, username: true } },
      originPointOfSale: { select: { id: true, name: true, code: true } },
      destinationPointOfSale: { select: { id: true, name: true, code: true } },
      product: { select: { id: true, description: true } },
    };
  }

  private serializeTransfer(row: any) {
    return {
      ...row,
      quantity: decimalToNumber(row.quantity),
      originBalanceBefore: decimalToNumber(row.originBalanceBefore),
      originBalanceAfter: decimalToNumber(row.originBalanceAfter),
      destinationBalanceBefore: decimalToNumber(row.destinationBalanceBefore),
      destinationBalanceAfter: decimalToNumber(row.destinationBalanceAfter),
    };
  }

  private endOfDay(value: string) {
    return new Date(`${value}T23:59:59.999-05:00`);
  }

  private startOfDay(value: string) {
    return new Date(`${value}T00:00:00.000-05:00`);
  }
}
