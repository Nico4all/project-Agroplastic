import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateClientDto } from './dto/create-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(userId: string, query: QueryClientsDto) {
    const actor = await this.users.getActiveUser(userId);
    const where = this.buildWhere(actor, query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true, username: true, city: true } } },
        orderBy: [{ isGeneral: 'desc' }, { city: 'asc' }, { fullName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async create(userId: string, dto: CreateClientDto) {
    const actor = await this.users.getActiveUser(userId);
    const isAdmin = actor.role === UserRole.ADMIN;
    const isGeneral = isAdmin ? Boolean(dto.isGeneral) : false;
    const city = isGeneral ? dto.city?.trim() || null : this.resolveCity(actor, dto.city);

    return this.prisma.client.create({
      data: {
        fullName: dto.fullName.trim(),
        identityDocument: dto.identityDocument.trim(),
        city,
        isGeneral,
        createdByUserId: actor.id,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateClientDto) {
    const actor = await this.users.getActiveUser(userId);
    const current = await this.findAccessible(actor, id);
    if (actor.role !== UserRole.ADMIN && current.createdByUserId !== actor.id) {
      throw new ForbiddenException('No puedes editar este cliente');
    }

    const isGeneral = actor.role === UserRole.ADMIN ? dto.isGeneral ?? current.isGeneral : current.isGeneral;
    const city = dto.city !== undefined ? (isGeneral ? dto.city.trim() || null : this.resolveCity(actor, dto.city)) : current.city;

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.identityDocument !== undefined ? { identityDocument: dto.identityDocument.trim() } : {}),
        city,
        isGeneral,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async findAccessible(actor: { id: string; role: UserRole; city: string | null }, id: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        ...(actor.role === UserRole.ADMIN ? {} : { OR: [{ isGeneral: true }, { city: actor.city || '__none__' }] }),
      },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  private buildWhere(actor: { role: UserRole; city: string | null }, query: QueryClientsDto): Prisma.ClientWhereInput {
    const and: Prisma.ClientWhereInput[] = [];
    if (actor.role !== UserRole.ADMIN) and.push({ OR: [{ isGeneral: true }, { city: actor.city || '__none__' }] });
    if (query.search) {
      and.push({
        OR: [
          { fullName: { contains: query.search } },
          { identityDocument: { contains: query.search } },
          { city: { contains: query.search } },
        ],
      });
    }

    return {
      ...(and.length ? { AND: and } : {}),
      ...(query.city && actor.role === UserRole.ADMIN ? { city: query.city } : {}),
      ...(query.isGeneral !== undefined ? { isGeneral: query.isGeneral } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  private resolveCity(actor: { role: UserRole; city: string | null }, requested?: string) {
    const city = actor.role === UserRole.ADMIN ? requested?.trim() : actor.city;
    if (!city) throw new BadRequestException('La ciudad es obligatoria');
    return city;
  }
}
