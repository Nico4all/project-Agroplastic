import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Workbook, Worksheet } from 'exceljs';
import { isAdminRole } from '../../common/helpers/roles';
import { cleanDisplayText, normalizeDescription } from '../../common/helpers/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { BulkUpdatePriceListPricesDto } from './dto/bulk-update-price-list-prices.dto';
import { CreatePriceListCategoryDto } from './dto/create-price-list-category.dto';
import { CreatePriceListProductDto } from './dto/create-price-list-product.dto';
import { QueryPriceListProductsDto } from './dto/query-price-list-products.dto';
import { UpdatePriceListProductDto } from './dto/update-price-list-product.dto';

@Injectable()
export class PriceListService {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService) {}

  async categories(userId: string) {
    await this.users.getActiveUser(userId);
    return this.prisma.priceListCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async createCategory(userId: string, dto: CreatePriceListCategoryDto) {
    await this.users.ensureSuperAdmin(userId);
    const name = cleanDisplayText(dto.name);
    const sortOrder = await this.prisma.priceListCategory.count();
    try {
      return await this.prisma.priceListCategory.create({
        data: { name, normalizedName: normalizeDescription(name), sortOrder },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('La categoría ya existe');
      }
      throw error;
    }
  }

  async products(userId: string, query: QueryPriceListProductsDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = actor.role === UserRole.BODEGA ? actor.pointOfSaleId : query.pointOfSaleId;
    if (actor.role === UserRole.BODEGA && !pointOfSaleId) {
      throw new BadRequestException('El usuario no tiene un punto de venta asignado');
    }
    if (!isAdminRole(actor.role) && query.pointOfSaleId && query.pointOfSaleId !== actor.pointOfSaleId) {
      throw new BadRequestException('No puedes consultar precios de otro punto de venta');
    }
    if (pointOfSaleId) {
      const point = await this.prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
      if (!point) throw new NotFoundException('Punto de venta no encontrado');
    }

    const products = await this.prisma.priceListProduct.findMany({
      where: {
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.search ? {
          OR: [
            { reference: { contains: cleanDisplayText(query.search) } },
            { measure: { contains: cleanDisplayText(query.search) } },
            { presentation: { contains: cleanDisplayText(query.search) } },
          ],
        } : {}),
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { supplier: { name: 'asc' } }, { reference: 'asc' }],
      include: {
        category: true,
        supplier: true,
        prices: pointOfSaleId ? { where: { pointOfSaleId }, take: 1 } : false,
      },
    });

    return products.map(({ prices, ...product }) => {
      const price = prices?.[0];
      return {
        ...product,
        pointOfSaleId: pointOfSaleId ?? null,
        primaryPrice: Number(price?.primaryPrice ?? product.defaultPrimaryPrice ?? 0) || null,
        secondaryPrice: Number(price?.secondaryPrice ?? product.defaultSecondaryPrice ?? 0) || null,
        primaryPriceNote: price?.primaryPriceNote ?? product.defaultPrimaryNote,
        secondaryPriceNote: price?.secondaryPriceNote ?? product.defaultSecondaryNote,
      };
    });
  }

  async exportProductsExcel(userId: string, query: QueryPriceListProductsDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = actor.role === UserRole.BODEGA ? actor.pointOfSaleId : query.pointOfSaleId;
    if (!pointOfSaleId) throw new BadRequestException('Selecciona el punto de venta que deseas exportar');
    if (!isAdminRole(actor.role) && query.pointOfSaleId && query.pointOfSaleId !== actor.pointOfSaleId) {
      throw new BadRequestException('No puedes exportar precios de otro punto de venta');
    }
    const point = await this.prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
    if (!point) throw new NotFoundException('Punto de venta no encontrado');

    const products = await this.products(userId, { pointOfSaleId, isActive: true });
    if (!products.length) throw new BadRequestException('No hay productos activos para exportar');
    const productsByCategory = new Map<string, typeof products>();
    products.forEach((product) => {
      const categoryProducts = productsByCategory.get(product.category.name) ?? [];
      categoryProducts.push(product);
      productsByCategory.set(product.category.name, categoryProducts);
    });

    const date = this.bogotaDate();
    const workbook = new Workbook();
    workbook.creator = 'AgroPlastick';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = `Lista de precios de ${point.name}`;
    workbook.title = `Listado de precios - ${point.name} - ${date}`;
    const usedSheetNames = new Set<string>();
    productsByCategory.forEach((categoryProducts, categoryName) => {
      const sheetName = this.uniqueSheetName(categoryName, usedSheetNames);
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 3 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });
      this.populatePriceSheet(worksheet, categoryName, point.name, date, categoryProducts);
    });

    const output = await workbook.xlsx.writeBuffer();
    const safePointName = point.name.replace(/[\\/:*?"<>|]/g, '-').trim();
    return {
      buffer: Buffer.from(output),
      filename: `Listado de precios - ${safePointName} - ${date}.xlsx`,
    };
  }

  private populatePriceSheet(
    worksheet: Worksheet,
    categoryName: string,
    pointOfSaleName: string,
    date: string,
    products: Awaited<ReturnType<PriceListService['products']>>,
  ) {
    const includeMeasure = products.some((product) => Boolean(product.measure));
    const includePrimaryNote = products.some((product) => Boolean(product.primaryPriceNote));
    const includeSecondaryNote = products.some((product) => Boolean(product.secondaryPriceNote));
    const primaryLabels = [...new Set(products.map((product) => product.primaryPriceLabel.trim()).filter(Boolean))];
    const secondaryLabels = [...new Set(products.map((product) => product.secondaryPriceLabel.trim()).filter(Boolean))];
    const primaryHeader = primaryLabels.length === 1 ? primaryLabels[0] : 'VALOR PRINCIPAL';
    const secondaryHeader = secondaryLabels.length === 1 ? secondaryLabels[0] : 'VALOR SECUNDARIO';
    const columns = [
      { key: 'supplier', header: 'PROVEEDOR', width: 24 },
      { key: 'reference', header: 'REFERENCIA', width: 58 },
      ...(includeMeasure ? [{ key: 'measure', header: 'MEDIDA', width: 18 }] : []),
      { key: 'presentation', header: 'PRESENTACIÓN', width: 28 },
      { key: 'primaryPrice', header: primaryHeader, width: 20 },
      ...(includePrimaryNote ? [{ key: 'primaryNote', header: 'ANOTACIÓN PRINCIPAL', width: 24 }] : []),
      { key: 'secondaryPrice', header: secondaryHeader, width: 20 },
      ...(includeSecondaryNote ? [{ key: 'secondaryNote', header: 'ANOTACIÓN SECUNDARIA', width: 24 }] : []),
    ];
    worksheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
    const lastColumn = worksheet.getColumn(columns.length).letter;
    worksheet.mergeCells(`A1:${lastColumn}1`);
    worksheet.mergeCells(`A2:${lastColumn}2`);
    worksheet.getCell('A1').value = `LISTADO DE PRECIOS - ${pointOfSaleName.toLocaleUpperCase('es-CO')} - ${date}`;
    worksheet.getCell('A2').value = categoryName.toLocaleUpperCase('es-CO');
    worksheet.getRow(3).values = columns.map((column) => column.header);

    const titleFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFF00' } };
    [worksheet.getRow(1), worksheet.getRow(2), worksheet.getRow(3)].forEach((row) => {
      row.fill = titleFill;
      row.font = { name: 'Arial', bold: true, color: { argb: 'FF000000' } };
      row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    worksheet.getRow(1).font = { name: 'Arial', bold: true, size: 16 };
    worksheet.getRow(2).font = { name: 'Arial', bold: true, size: 14 };
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 23;
    worksheet.getRow(3).height = 28;

    const supplierColors = ['FFFF3D00', 'FFC6E6F7', 'FFD9EAD3', 'FFFCE5CD', 'FFD9D2E9'];
    let supplierIndex = -1;
    let previousSupplier = '';
    products.forEach((product) => {
      if (product.supplier.name !== previousSupplier) {
        supplierIndex += 1;
        previousSupplier = product.supplier.name;
      }
      const row = worksheet.addRow({
        supplier: product.supplier.name,
        reference: product.reference,
        ...(includeMeasure ? { measure: product.measure || '' } : {}),
        presentation: product.presentation || '',
        primaryPrice: product.primaryPrice ?? null,
        ...(includePrimaryNote ? { primaryNote: product.primaryPriceNote || null } : {}),
        secondaryPrice: product.secondaryPrice ?? null,
        ...(includeSecondaryNote ? { secondaryNote: product.secondaryPriceNote || null } : {}),
      });
      row.font = { name: 'Arial', size: 10 };
      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = 22;
      const supplierCell = row.getCell('supplier');
      supplierCell.font = { name: 'Arial', size: 10, bold: true };
      supplierCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: supplierColors[supplierIndex % supplierColors.length] } };
      ['primaryPrice', 'secondaryPrice'].forEach((key) => {
        const cell = row.getCell(key);
        cell.numFmt = '"$" #,##0';
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
      if (product.primaryPriceNote) row.getCell('primaryPrice').note = product.primaryPriceNote;
      if (product.secondaryPriceNote) row.getCell('secondaryPrice').note = product.secondaryPriceNote;
    });

    worksheet.autoFilter = { from: 'A3', to: `${lastColumn}${worksheet.rowCount}` };
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF222222' } },
          left: { style: 'thin', color: { argb: 'FF222222' } },
          bottom: { style: 'thin', color: { argb: 'FF222222' } },
          right: { style: 'thin', color: { argb: 'FF222222' } },
        };
      });
    }
    worksheet.properties.defaultRowHeight = 20;
    worksheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  }

  private uniqueSheetName(categoryName: string, usedNames: Set<string>) {
    const base = (categoryName.replace(/[\\/*?:\[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Categoría').slice(0, 31);
    let name = base;
    let suffix = 2;
    while (usedNames.has(name.toLocaleLowerCase('es-CO'))) {
      const ending = ` ${suffix}`;
      name = `${base.slice(0, 31 - ending.length)}${ending}`;
      suffix += 1;
    }
    usedNames.add(name.toLocaleLowerCase('es-CO'));
    return name;
  }

  private bogotaDate() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  async createProduct(userId: string, dto: CreatePriceListProductDto) {
    await this.users.ensureSuperAdmin(userId);
    const reference = cleanDisplayText(dto.reference);
    if (!reference) throw new BadRequestException('La referencia es obligatoria');
    const [category, supplier, points] = await Promise.all([
      this.prisma.priceListCategory.findUnique({ where: { id: dto.categoryId } }),
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.pointOfSale.findMany({ select: { id: true } }),
    ]);
    if (!category) throw new NotFoundException('Categoría no encontrada');
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.priceListProduct.create({
        data: {
          sourceKey: `MANUAL|${randomUUID()}`,
          categoryId: category.id,
          supplierId: supplier.id,
          reference,
          measure: cleanDisplayText(dto.measure || '') || null,
          presentation: cleanDisplayText(dto.presentation || '') || null,
          primaryPriceLabel: cleanDisplayText(dto.primaryPriceLabel),
          secondaryPriceLabel: cleanDisplayText(dto.secondaryPriceLabel),
          defaultPrimaryPrice: dto.primaryPrice,
          defaultSecondaryPrice: dto.secondaryPrice,
          defaultPrimaryNote: cleanDisplayText(dto.primaryPriceNote || '') || null,
          defaultSecondaryNote: cleanDisplayText(dto.secondaryPriceNote || '') || null,
        },
      });
      if (points.length) {
        await tx.pointOfSalePrice.createMany({
          data: points.map((point) => ({
            pointOfSaleId: point.id,
            productId: product.id,
            primaryPrice: dto.primaryPrice,
            secondaryPrice: dto.secondaryPrice,
            primaryPriceNote: cleanDisplayText(dto.primaryPriceNote || '') || null,
            secondaryPriceNote: cleanDisplayText(dto.secondaryPriceNote || '') || null,
          })),
        });
      }
      return product;
    });
  }

  async bulkUpdatePrices(userId: string, dto: BulkUpdatePriceListPricesDto) {
    await this.users.ensureSuperAdmin(userId);
    const point = await this.prisma.pointOfSale.findUnique({ where: { id: dto.pointOfSaleId } });
    if (!point) throw new NotFoundException('Punto de venta no encontrado');

    const productIds = dto.updates.map((update) => update.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('No puedes enviar el mismo producto más de una vez');
    }
    if (dto.updates.some((update) => update.primaryPrice === undefined && update.secondaryPrice === undefined)) {
      throw new BadRequestException('Cada producto debe incluir al menos un precio para actualizar');
    }

    const products = await this.prisma.priceListProduct.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        defaultPrimaryPrice: true,
        defaultSecondaryPrice: true,
        defaultPrimaryNote: true,
        defaultSecondaryNote: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Uno o más productos de la lista no existen');
    }
    const productsById = new Map(products.map((product) => [product.id, product]));

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(dto.updates.map((update) => {
        const product = productsById.get(update.productId)!;
        return tx.pointOfSalePrice.upsert({
          where: {
            pointOfSaleId_productId: {
              pointOfSaleId: dto.pointOfSaleId,
              productId: update.productId,
            },
          },
          create: {
            pointOfSaleId: dto.pointOfSaleId,
            productId: update.productId,
            primaryPrice: update.primaryPrice === undefined ? product.defaultPrimaryPrice : update.primaryPrice,
            secondaryPrice: update.secondaryPrice === undefined ? product.defaultSecondaryPrice : update.secondaryPrice,
            primaryPriceNote: product.defaultPrimaryNote,
            secondaryPriceNote: product.defaultSecondaryNote,
          },
          update: {
            ...(update.primaryPrice !== undefined ? { primaryPrice: update.primaryPrice } : {}),
            ...(update.secondaryPrice !== undefined ? { secondaryPrice: update.secondaryPrice } : {}),
          },
        });
      }));
    }, { timeout: 30000 });

    return { updated: dto.updates.length, pointOfSaleId: dto.pointOfSaleId };
  }

  async updateProduct(userId: string, id: string, dto: UpdatePriceListProductDto) {
    await this.users.ensureSuperAdmin(userId);
    const current = await this.prisma.priceListProduct.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Producto de lista no encontrado');
    const hasPriceChanges = dto.primaryPrice !== undefined
      || dto.secondaryPrice !== undefined
      || dto.primaryPriceNote !== undefined
      || dto.secondaryPriceNote !== undefined;
    if (hasPriceChanges && !dto.pointOfSaleId) {
      throw new BadRequestException('Selecciona el punto de venta cuyo precio deseas editar');
    }
    if (dto.categoryId && !await this.prisma.priceListCategory.findUnique({ where: { id: dto.categoryId } })) {
      throw new NotFoundException('Categoría no encontrada');
    }
    if (dto.supplierId && !await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } })) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    if (dto.pointOfSaleId && !await this.prisma.pointOfSale.findUnique({ where: { id: dto.pointOfSaleId } })) {
      throw new NotFoundException('Punto de venta no encontrado');
    }

    const primaryPriceNote = dto.primaryPriceNote === undefined
      ? undefined
      : cleanDisplayText(dto.primaryPriceNote || '') || null;
    const secondaryPriceNote = dto.secondaryPriceNote === undefined
      ? undefined
      : cleanDisplayText(dto.secondaryPriceNote || '') || null;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.priceListProduct.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
          ...(dto.reference !== undefined ? { reference: cleanDisplayText(dto.reference) } : {}),
          ...(dto.measure !== undefined ? { measure: cleanDisplayText(dto.measure) || null } : {}),
          ...(dto.presentation !== undefined ? { presentation: cleanDisplayText(dto.presentation) || null } : {}),
          ...(dto.primaryPriceLabel !== undefined ? { primaryPriceLabel: cleanDisplayText(dto.primaryPriceLabel) } : {}),
          ...(dto.secondaryPriceLabel !== undefined ? { secondaryPriceLabel: cleanDisplayText(dto.secondaryPriceLabel) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      if (hasPriceChanges && dto.pointOfSaleId) {
        await tx.pointOfSalePrice.upsert({
          where: { pointOfSaleId_productId: { pointOfSaleId: dto.pointOfSaleId, productId: id } },
          create: {
            pointOfSaleId: dto.pointOfSaleId,
            productId: id,
            primaryPrice: dto.primaryPrice === undefined ? current.defaultPrimaryPrice : dto.primaryPrice,
            secondaryPrice: dto.secondaryPrice === undefined ? current.defaultSecondaryPrice : dto.secondaryPrice,
            primaryPriceNote: primaryPriceNote === undefined ? current.defaultPrimaryNote : primaryPriceNote,
            secondaryPriceNote: secondaryPriceNote === undefined ? current.defaultSecondaryNote : secondaryPriceNote,
          },
          update: {
            ...(dto.primaryPrice !== undefined ? { primaryPrice: dto.primaryPrice } : {}),
            ...(dto.secondaryPrice !== undefined ? { secondaryPrice: dto.secondaryPrice } : {}),
            ...(primaryPriceNote !== undefined ? { primaryPriceNote } : {}),
            ...(secondaryPriceNote !== undefined ? { secondaryPriceNote } : {}),
          },
        });
      }
      return product;
    });
  }
}
