import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { cleanDisplayText, normalizeDescription } from '../../common/helpers/normalization';
import { isAdminRole } from '../../common/helpers/roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(userId: string, query: QueryProductsDto) {
    const actor = await this.users.getActiveUser(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, query.pointOfSaleId);
    const rows = await this.prisma.inventoryStock.findMany({
      where: {
        pointOfSaleId,
        ...(query.search ? { product: { description: { contains: query.search } } } : {}),
        ...(query.isActive !== undefined
          ? query.isActive
            ? { isActive: true }
            : { isActive: false }
          : {}),
      },
      include: { product: true, pointOfSale: { select: { id: true, name: true } } },
      orderBy: [{ isActive: 'desc' }, { product: { description: 'asc' } }],
    });
    rows.sort((a, b) => {
      const availabilityGroup = Number(b.quantity.gt(1)) - Number(a.quantity.gt(1));
      if (availabilityGroup !== 0) return availabilityGroup;
      if (a.isActive !== b.isActive) return Number(b.isActive) - Number(a.isActive);
      return a.product.description.localeCompare(b.product.description, 'es-CO');
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(userId: string, dto: CreateProductDto) {
    const actor = await this.users.ensureAdmin(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, dto.pointOfSaleId);
    const description = cleanDisplayText(dto.description);
    if (!description) throw new BadRequestException('La descripcion es obligatoria');
    const normalizedDescription = normalizeDescription(description);
    const packageConfiguration = this.packageConfiguration(dto);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        let product = await tx.product.findUnique({ where: { normalizedDescription } });
        if (!product) {
          product = await tx.product.create({
            data: { description, normalizedDescription, createdByUserId: actor.id },
          });
        }
        const exists = await tx.inventoryStock.findUnique({
          where: { pointOfSaleId_productId: { pointOfSaleId, productId: product.id } },
        });
        if (exists) throw new ConflictException('El producto ya existe en este punto de venta');
        return tx.inventoryStock.create({
          data: {
            pointOfSaleId,
            productId: product.id,
            unitPrice: new Prisma.Decimal(dto.unitPrice),
            ...packageConfiguration,
          },
          include: { product: true, pointOfSale: { select: { id: true, name: true } } },
        });
      });
      return this.serialize(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El producto ya existe');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    const actor = await this.users.ensureAdmin(userId);
    const pointOfSaleId = await this.resolvePointOfSale(actor, dto.pointOfSaleId);
    const packageConfigurationChanged =
      dto.packageLabel !== undefined || dto.unitsPerPackage !== undefined || dto.packagePrice !== undefined;
    if (dto.description === undefined && dto.isActive === undefined && dto.unitPrice === undefined && !packageConfigurationChanged) {
      throw new BadRequestException('Debes indicar la descripcion, el precio, la presentacion o el estado');
    }
    const current = await this.prisma.inventoryStock.findUnique({
      where: { pointOfSaleId_productId: { pointOfSaleId, productId: id } },
      include: { product: true },
    });
    if (!current) throw new NotFoundException('Producto no encontrado en este punto de venta');

    const description = dto.description === undefined ? undefined : cleanDisplayText(dto.description);
    if (description !== undefined && !description) throw new BadRequestException('La descripcion es obligatoria');
    const packageConfiguration = packageConfigurationChanged
      ? this.packageConfiguration({
          packageLabel: dto.packageLabel !== undefined ? dto.packageLabel : current.packageLabel,
          unitsPerPackage: dto.unitsPerPackage !== undefined ? dto.unitsPerPackage : current.unitsPerPackage,
          packagePrice: dto.packagePrice !== undefined ? dto.packagePrice : current.packagePrice,
        })
      : undefined;

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (description !== undefined) {
          await tx.product.update({
            where: { id },
            data: { description, normalizedDescription: normalizeDescription(description) },
          });
        }
        return tx.inventoryStock.update({
          where: { id: current.id },
          data: {
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            ...(dto.unitPrice !== undefined ? { unitPrice: new Prisma.Decimal(dto.unitPrice) } : {}),
            ...(packageConfiguration || {}),
          },
          include: { product: true, pointOfSale: { select: { id: true, name: true } } },
        });
      });
      return this.serialize(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El producto ya existe');
      }
      throw error;
    }
  }

  private async resolvePointOfSale(actor: User, requested?: string) {
    const pointOfSaleId = isAdminRole(actor.role) ? requested || actor.pointOfSaleId : actor.pointOfSaleId;
    if (!pointOfSaleId) throw new BadRequestException('Selecciona un punto de venta');
    const point = await this.prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
    if (!point || !point.isActive) throw new BadRequestException('El punto de venta no existe o esta inactivo');
    return pointOfSaleId;
  }

  private packageConfiguration(input: {
    packageLabel?: string | null;
    unitsPerPackage?: number | Prisma.Decimal | null;
    packagePrice?: number | Prisma.Decimal | null;
  }) {
    const packageLabel = cleanDisplayText(input.packageLabel || '') || null;
    const unitsPerPackage = input.unitsPerPackage == null ? null : new Prisma.Decimal(input.unitsPerPackage);
    const packagePrice = input.packagePrice == null ? null : new Prisma.Decimal(input.packagePrice);
    const hasAnyValue = packageLabel !== null || unitsPerPackage !== null || packagePrice !== null;

    if (!hasAnyValue) return { packageLabel: null, unitsPerPackage: null, packagePrice: null };
    if (!packageLabel || !unitsPerPackage || !packagePrice) {
      throw new BadRequestException('Para habilitar otra presentacion indica el nombre, las unidades equivalentes y su precio');
    }
    if (unitsPerPackage.lessThanOrEqualTo(0) || packagePrice.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La equivalencia y el precio de la presentacion deben ser mayores a cero');
    }
    return { packageLabel, unitsPerPackage, packagePrice };
  }

  private serialize(row: any) {
    return {
      id: row.product.id,
      inventoryStockId: row.id,
      pointOfSaleId: row.pointOfSaleId,
      pointOfSale: row.pointOfSale,
      description: row.product.description,
      quantity: decimalToNumber(row.quantity),
      unitPrice: decimalToNumber(row.unitPrice),
      packageLabel: row.packageLabel,
      unitsPerPackage: row.unitsPerPackage == null ? null : decimalToNumber(row.unitsPerPackage),
      packagePrice: row.packagePrice == null ? null : decimalToNumber(row.packagePrice),
      isActive: Boolean(row.isActive),
      createdAt: row.product.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
