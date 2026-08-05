import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { isAdminRole } from '../../common/helpers/roles';
import { cleanDisplayText, normalizeDescription } from '../../common/helpers/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
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
