import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma, User } from '@prisma/client';
import { Workbook } from 'exceljs';
import { decimalToNumber } from '../../common/helpers/money';
import { cleanDisplayText } from '../../common/helpers/normalization';
import { buildListPdf, formatDate } from '../../common/helpers/reports';
import { isAdminRole } from '../../common/helpers/roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateInventoryAdjustmentDto, InventoryAdjustmentOperation } from './dto/create-inventory-adjustment.dto';
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

    const result = await this.prisma.$transaction(async (tx) => {
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
      const movement = await tx.inventoryMovement.create({
        data: {
          pointOfSaleId,
          productId: dto.productId,
          userId: actor.id,
          type: isAddition ? InventoryMovementType.ADJUSTMENT_ADD : InventoryMovementType.ADJUSTMENT_SUBTRACT,
          quantityChange: isAddition ? quantity : quantity.negated(),
          balanceAfter: stock.quantity,
        },
      });
      return { stock, movementId: movement.id };
    });

    return {
      id: result.stock.id,
      productId: result.stock.productId,
      pointOfSaleId: result.stock.pointOfSaleId,
      pointOfSale: result.stock.pointOfSale,
      productDescription: result.stock.product.description,
      quantity: decimalToNumber(result.stock.quantity),
      isActive: Boolean(result.stock.isActive),
      updatedAt: result.stock.updatedAt,
      movementId: result.movementId,
    };
  }

  private async resolvePointOfSale(actor: User, requested?: string) {
    const pointOfSaleId = isAdminRole(actor.role) ? requested || actor.pointOfSaleId : actor.pointOfSaleId;
    if (!pointOfSaleId) throw new BadRequestException('Selecciona un punto de venta');
    const point = await this.prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
    if (!point || !point.isActive) throw new BadRequestException('El punto de venta no existe o esta inactivo');
    return pointOfSaleId;
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

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
