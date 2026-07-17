import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { cleanDisplayText, normalizeIdentityDocument } from '../../common/helpers/normalization';
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
    await this.users.getActiveUser(userId);
    const where = this.buildWhere(query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true, username: true, documentSuffix: true } } },
        orderBy: { fullName: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async create(userId: string, dto: CreateClientDto) {
    const actor = await this.users.getActiveUser(userId);
    const fullName = cleanDisplayText(dto.fullName);
    const identityDocumentKey = normalizeIdentityDocument(dto.identityDocument);
    if (!fullName) throw new BadRequestException('El nombre es obligatorio');
    if (!identityDocumentKey) throw new BadRequestException('El documento es obligatorio');

    try {
      return await this.prisma.client.create({
        data: {
          fullName,
          identityDocument: cleanDisplayText(dto.identityDocument).toLocaleUpperCase('es-CO'),
          identityDocumentKey,
          createdByUserId: actor.id,
        },
      });
    } catch (error) {
      this.throwDuplicateDocument(error);
    }
  }

  async update(userId: string, id: string, dto: UpdateClientDto) {
    const actor = await this.users.getActiveUser(userId);
    const current = await this.findAccessible(actor, id);
    if (actor.role !== UserRole.ADMIN && current.createdByUserId !== actor.id) {
      throw new ForbiddenException('No puedes editar este cliente');
    }
    if (dto.fullName !== undefined && !cleanDisplayText(dto.fullName)) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (dto.identityDocument !== undefined && !normalizeIdentityDocument(dto.identityDocument)) {
      throw new BadRequestException('El documento es obligatorio');
    }

    try {
      return await this.prisma.client.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: cleanDisplayText(dto.fullName) } : {}),
          ...(dto.identityDocument !== undefined
            ? {
                identityDocument: cleanDisplayText(dto.identityDocument).toLocaleUpperCase('es-CO'),
                identityDocumentKey: normalizeIdentityDocument(dto.identityDocument),
              }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      this.throwDuplicateDocument(error);
    }
  }

  async findAccessible(_actor: { id: string; role: UserRole }, id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  private buildWhere(query: QueryClientsDto): Prisma.ClientWhereInput {
    const and: Prisma.ClientWhereInput[] = [];
    if (query.search) {
      and.push({
        OR: [
          { fullName: { contains: query.search } },
          { identityDocument: { contains: query.search } },
        ],
      });
    }

    return {
      ...(and.length ? { AND: and } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  private throwDuplicateDocument(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ya existe un cliente con este documento');
    }
    throw error;
  }
}
