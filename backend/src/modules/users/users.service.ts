import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';

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
        city: true,
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
        city: true,
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

    const passwordHash = await argon2.hash(dto.password);
    const city = dto.city?.trim() || null;
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('El nombre es obligatorio');

    const user = await this.prisma.user.create({
      data: {
        name,
        username,
        email: `${username}@local.agroplastic`,
        passwordHash,
        role: UserRole.BODEGA,
        city,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        city: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
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
