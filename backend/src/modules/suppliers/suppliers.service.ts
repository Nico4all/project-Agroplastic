import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cleanDisplayText, normalizeDescription } from '../../common/helpers/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService) {}

  async findAll(userId: string) {
    await this.users.getActiveUser(userId);
    return this.prisma.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async create(userId: string, dto: CreateSupplierDto) {
    await this.users.ensureSuperAdmin(userId);
    const name = cleanDisplayText(dto.name);
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    try {
      return await this.prisma.supplier.create({
        data: { name, normalizedName: normalizeDescription(name) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El proveedor ya existe');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateSupplierDto) {
    await this.users.ensureSuperAdmin(userId);
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Debes indicar el nombre o el estado');
    }
    const current = await this.prisma.supplier.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Proveedor no encontrado');
    const name = dto.name === undefined ? undefined : cleanDisplayText(dto.name);
    if (name !== undefined && !name) throw new BadRequestException('El nombre es obligatorio');
    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name, normalizedName: normalizeDescription(name) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El proveedor ya existe');
      }
      throw error;
    }
  }
}
