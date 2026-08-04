import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cleanDisplayText, normalizeDocumentSuffix } from '../../common/helpers/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreatePointOfSaleDto } from './dto/create-point-of-sale.dto';
import { UpdatePointOfSaleDto } from './dto/update-point-of-sale.dto';

const pointOfSaleSelect = {
  id: true,
  name: true,
  code: true,
  city: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true } },
} satisfies Prisma.PointOfSaleSelect;

@Injectable()
export class PointsOfSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(requestUserId: string) {
    await this.users.ensureAdmin(requestUserId);
    return this.prisma.pointOfSale.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: pointOfSaleSelect,
    });
  }

  async create(requestUserId: string, dto: CreatePointOfSaleDto) {
    await this.users.ensureAdmin(requestUserId);
    const data = this.normalizeData(dto);
    if (!data.name || !data.code) throw new BadRequestException('El nombre y el codigo son obligatorios');

    try {
      return await this.prisma.pointOfSale.create({
        data: { ...data, name: data.name, code: data.code },
        select: pointOfSaleSelect,
      });
    } catch (error) {
      this.handleUniqueError(error);
      throw error;
    }
  }

  async update(requestUserId: string, id: string, dto: UpdatePointOfSaleDto) {
    await this.users.ensureAdmin(requestUserId);
    const current = await this.prisma.pointOfSale.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Punto de venta no encontrado');

    if (dto.isActive === false && current.isActive) {
      const activeUsers = await this.prisma.user.count({ where: { pointOfSaleId: id, isActive: true } });
      if (activeUsers > 0) {
        throw new ConflictException('No puedes desactivar un punto de venta que tiene usuarios activos');
      }
    }

    const normalized = this.normalizeData(dto);
    try {
      return await this.prisma.pointOfSale.update({
        where: { id },
        data: {
          ...normalized,
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: pointOfSaleSelect,
      });
    } catch (error) {
      this.handleUniqueError(error);
      throw error;
    }
  }

  private normalizeData(dto: CreatePointOfSaleDto | UpdatePointOfSaleDto) {
    const name = dto.name === undefined ? undefined : cleanDisplayText(dto.name);
    const code = dto.code === undefined ? undefined : normalizeDocumentSuffix(dto.code);
    const city = dto.city === undefined ? undefined : cleanDisplayText(dto.city) || null;
    const address = dto.address === undefined ? undefined : cleanDisplayText(dto.address) || null;

    if (dto.name !== undefined && !name) throw new BadRequestException('El nombre es obligatorio');
    if (dto.code !== undefined && !code) throw new BadRequestException('El codigo es obligatorio');

    return {
      ...(name !== undefined ? { name } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(address !== undefined ? { address } : {}),
    };
  }

  private handleUniqueError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ya existe un punto de venta con ese codigo');
    }
  }
}
