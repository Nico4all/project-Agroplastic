import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cleanDisplayText, normalizeDescription } from '../../common/helpers/normalization';
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
    await this.users.getActiveUser(userId);
    return this.prisma.product.findMany({
      where: {
        ...(query.search ? { description: { contains: query.search } } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { description: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateProductDto) {
    const actor = await this.users.ensureAdmin(userId);
    const description = cleanDisplayText(dto.description);
    if (!description) throw new BadRequestException('La descripcion es obligatoria');

    try {
      return await this.prisma.product.create({
        data: {
          description,
          normalizedDescription: normalizeDescription(description),
          createdByUserId: actor.id,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El producto ya existe');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    await this.users.ensureAdmin(userId);
    if (dto.description === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Debes indicar la descripcion o el estado');
    }

    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Producto no encontrado');

    const description = dto.description === undefined ? undefined : cleanDisplayText(dto.description);
    if (description !== undefined && !description) {
      throw new BadRequestException('La descripcion es obligatoria');
    }

    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...(description !== undefined
            ? { description, normalizedDescription: normalizeDescription(description) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El producto ya existe');
      }
      throw error;
    }
  }
}
