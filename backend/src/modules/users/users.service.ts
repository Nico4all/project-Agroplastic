import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeDocumentSuffix } from '../../common/helpers/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        pointOfSaleId: true,
        pointOfSale: {
          select: { id: true, name: true, code: true, city: true, address: true, isActive: true },
        },
        documentSuffix: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findAll(requestUserId: string) {
    await this.ensureAdmin(requestUserId);
    return this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        pointOfSaleId: true,
        pointOfSale: {
          select: { id: true, name: true, code: true, city: true, address: true, isActive: true },
        },
        documentSuffix: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async createManaged(requestUserId: string, dto: CreateManagedUserDto) {
    await this.ensureAdmin(requestUserId);

    const maxUsers = Number(this.config.get<string>('MAX_WAREHOUSE_USERS') || 4);
    const currentCount = await this.prisma.user.count({ where: { role: UserRole.BODEGA } });
    if (currentCount >= maxUsers) {
      throw new BadRequestException(`Limite de usuarios de bodega alcanzado (${maxUsers})`);
    }

    const username = this.normalizeUsername(dto.username);
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new ConflictException('El usuario ya existe');

    const pointOfSale = await this.prisma.pointOfSale.findUnique({ where: { id: dto.pointOfSaleId } });
    if (!pointOfSale) throw new NotFoundException('Punto de venta no encontrado');
    if (!pointOfSale.isActive) throw new BadRequestException('El punto de venta seleccionado esta inactivo');

    const passwordHash = await argon2.hash(dto.password);
    const documentSuffix = normalizeDocumentSuffix(dto.documentSuffix);
    if (!documentSuffix) throw new BadRequestException('El sufijo de documentos es obligatorio');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('El nombre es obligatorio');

    try {
      return await this.prisma.user.create({
        data: {
          name,
          username,
          email: `${username}@local.agroplastic`,
          passwordHash,
          role: UserRole.BODEGA,
          pointOfSaleId: pointOfSale.id,
          documentSuffix,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          pointOfSaleId: true,
          pointOfSale: {
            select: { id: true, name: true, code: true, city: true, address: true, isActive: true },
          },
          documentSuffix: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El usuario o el sufijo de documentos ya existe');
      }
      throw error;
    }
  }

  async updateManaged(requestUserId: string, userId: string, dto: UpdateManagedUserDto) {
    await this.ensureAdmin(requestUserId);

    if (dto.name === undefined && dto.isActive === undefined && dto.password === undefined && dto.pointOfSaleId === undefined) {
      throw new BadRequestException('Debes indicar el nombre, el punto de venta, el estado o una nueva contrasena');
    }

    const managedUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!managedUser) throw new NotFoundException('Usuario no encontrado');
    if (managedUser.role !== UserRole.BODEGA) {
      throw new ForbiddenException('La cuenta administradora no se puede modificar desde esta pantalla');
    }

    const effectivePointOfSaleId = dto.pointOfSaleId ?? managedUser.pointOfSaleId;
    if (!effectivePointOfSaleId) throw new BadRequestException('El usuario debe tener un punto de venta');
    const pointOfSale = await this.prisma.pointOfSale.findUnique({ where: { id: effectivePointOfSaleId } });
    if (!pointOfSale) throw new NotFoundException('Punto de venta no encontrado');
    if (!pointOfSale.isActive && (dto.pointOfSaleId !== undefined || dto.isActive === true)) {
      throw new BadRequestException('El punto de venta seleccionado esta inactivo');
    }

    if (dto.password !== undefined && !dto.password.trim()) {
      throw new BadRequestException('La nueva contrasena no puede estar vacia');
    }
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    const passwordHash = dto.password === undefined ? undefined : await argon2.hash(dto.password);
    const shouldRevokeSessions = passwordHash !== undefined || dto.isActive === false;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(dto.pointOfSaleId !== undefined ? { pointOfSaleId: pointOfSale.id } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          pointOfSaleId: true,
          pointOfSale: {
            select: { id: true, name: true, code: true, city: true, address: true, isActive: true },
          },
          documentSuffix: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (shouldRevokeSessions) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      return updated;
    });
  }

  async ensureAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Solo el administrador puede realizar esta accion');
    return user;
  }

  async getActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }
}
