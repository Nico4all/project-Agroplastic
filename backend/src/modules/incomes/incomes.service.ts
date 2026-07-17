import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, User, UserRole } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { buildExcelHtml, buildSimplePdf, formatDate, formatMoney } from '../../common/helpers/reports';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { QueryIncomesDto } from './dto/query-incomes.dto';
import { VoidIncomeDto } from './dto/void-income.dto';

@Injectable()
export class IncomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly clients: ClientsService,
  ) {}

  async findAll(userId: string, query: QueryIncomesDto) {
    const actor = await this.users.getActiveUser(userId);
    const where = this.buildWhere(actor, query);
    const [total, data, grouped] = await this.prisma.$transaction([
      this.prisma.income.count({ where }),
      this.prisma.income.findMany({
        where,
        include: this.includeRelations(),
        orderBy: { incomeDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.income.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _sum: { amount: true },
      }),
    ]);

    return {
      data: data.map((row) => this.serialize(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        active: decimalToNumber(grouped.find((row) => row.status === RecordStatus.ACTIVE)?._sum?.amount ?? null),
        void: decimalToNumber(grouped.find((row) => row.status === RecordStatus.VOID)?._sum?.amount ?? null),
      },
    };
  }

  async create(userId: string, dto: CreateIncomeDto) {
    const actor = await this.users.getActiveUser(userId);
    const client = await this.clients.findAccessible(actor, dto.clientId);
    if (!client.isActive) throw new BadRequestException('El cliente esta inactivo');

    const income = await this.prisma.$transaction(async (transaction) => {
      const numberedUser = await transaction.user.update({
        where: { id: actor.id },
        data: { nextIncomeNumber: { increment: 1 } },
        select: { documentSuffix: true, nextIncomeNumber: true },
      });
      const documentSequence = numberedUser.nextIncomeNumber - 1;

      return transaction.income.create({
        data: {
          userId: actor.id,
          clientId: client.id,
          clientName: client.fullName,
          clientDocument: client.identityDocument,
          documentSequence,
          documentNumber: `${numberedUser.documentSuffix}-${documentSequence}`,
          type: dto.type,
          paymentMethod: dto.paymentMethod,
          amount: new Prisma.Decimal(dto.amount),
          description: dto.description?.trim() || null,
          incomeDate: new Date(dto.incomeDate),
        },
        include: this.includeRelations(),
      });
    });

    return this.serialize(income);
  }

  async void(userId: string, id: string, dto: VoidIncomeDto) {
    const actor = await this.users.getActiveUser(userId);
    const current = await this.findAccessible(actor, id);
    if (current.status === RecordStatus.VOID) return this.serialize(current);

    const updated = await this.prisma.income.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        causedAt: null,
        voidReason: dto.reason?.trim() || null,
        voidedAt: new Date(),
        voidedByUserId: actor.id,
      },
      include: this.includeRelations(),
    });

    return this.serialize(updated);
  }

  async updateCausedStatus(userId: string, id: string, isCaused: boolean) {
    await this.users.ensureAdmin(userId);
    const current = await this.prisma.income.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!current) throw new NotFoundException('Ingreso no encontrado');
    if (isCaused && current.status === RecordStatus.VOID) {
      throw new BadRequestException('No puedes causar un ingreso anulado');
    }

    const updated = await this.prisma.income.update({
      where: { id },
      data: { causedAt: isCaused ? new Date() : null },
      include: this.includeRelations(),
    });
    return this.serialize(updated);
  }

  async exportExcel(userId: string, query: QueryIncomesDto) {
    const rows = await this.findRowsForExport(userId, query);
    return buildExcelHtml(
      'Listado de ingresos',
      ['Id documento', 'Fecha', 'Usuario', 'Cliente', 'Documento cliente', 'Tipo', 'Ingreso', 'Valor', 'Estado', 'Causacion', 'Descripcion'],
      rows.map((row) => [
        row.documentNumber,
        formatDate(row.incomeDate),
        row.user.name,
        row.clientName,
        row.clientDocument,
        this.incomeTypeLabel(row.type),
        this.paymentMethodLabel(row.paymentMethod),
        decimalToNumber(row.amount),
        this.statusLabel(row.status),
        row.causedAt ? 'Causado' : 'Pendiente',
        row.description || '',
      ]),
    );
  }

  async exportPdf(userId: string, query: QueryIncomesDto) {
    const rows = await this.findRowsForExport(userId, query);
    const total = rows
      .filter((row) => row.status === RecordStatus.ACTIVE)
      .reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
    const lines = [
      `Total activo: ${formatMoney(total)}`,
      `Registros: ${rows.length}`,
      '',
      ...rows.slice(0, 42).map((row) =>
        `${row.documentNumber} | ${formatDate(row.incomeDate)} | ${row.user.name} | ${row.clientName} | ${this.incomeTypeLabel(row.type)} | ${formatMoney(decimalToNumber(row.amount))} | ${this.statusLabel(row.status)} | ${row.causedAt ? 'Causado' : 'Pendiente'}`,
      ),
    ];
    return buildSimplePdf('Listado de ingresos', lines);
  }

  async receiptPdf(userId: string, id: string) {
    const actor = await this.users.getActiveUser(userId);
    const income = await this.findAccessible(actor, id);
    const lines = [
      `Fecha: ${formatDate(income.incomeDate)}`,
      `No - Id: ${income.documentNumber}`,
      `Cliente: ${income.clientName}`,
      `Documento: ${income.clientDocument}`,
      `Tipo: ${this.incomeTypeLabel(income.type)}`,
      `Ingreso: ${this.paymentMethodLabel(income.paymentMethod)}`,
      `Valor: ${formatMoney(decimalToNumber(income.amount))}`,
      `Descripcion: ${income.description || ''}`,
      `Estado: ${this.statusLabel(income.status)}`,
      `Causacion: ${income.causedAt ? 'Causado' : 'Pendiente'}`,
      income.status === RecordStatus.VOID ? `Anulado: ${income.voidReason || 'Sin motivo'}` : '',
    ].filter(Boolean);
    return buildSimplePdf('Soporte de ingreso', lines);
  }

  private async findAccessible(actor: User, id: string) {
    const row = await this.prisma.income.findFirst({
      where: { id, ...(actor.role === UserRole.ADMIN ? {} : { userId: actor.id }) },
      include: this.includeRelations(),
    });
    if (!row) throw new NotFoundException('Ingreso no encontrado');
    return row;
  }

  private async findRowsForExport(userId: string, query: QueryIncomesDto) {
    const actor = await this.users.getActiveUser(userId);
    return this.prisma.income.findMany({
      where: this.buildWhere(actor, query),
      include: this.includeRelations(),
      orderBy: { incomeDate: query.sort || 'desc' },
      take: 5000,
    });
  }

  private buildWhere(actor: User, query: QueryIncomesDto): Prisma.IncomeWhereInput {
    const and: Prisma.IncomeWhereInput[] = [];
    if (actor.role !== UserRole.ADMIN) and.push({ userId: actor.id });
    if (query.search) {
      and.push({
        OR: [
          { description: { contains: query.search } },
          { clientName: { contains: query.search } },
          { clientDocument: { contains: query.search } },
          { documentNumber: { contains: query.search } },
        ],
      });
    }

    const date: Prisma.DateTimeFilter = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = this.endOfDay(query.toDate);

    return {
      ...(and.length ? { AND: and } : {}),
      ...(actor.role === UserRole.ADMIN && query.userId ? { userId: query.userId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(Object.keys(date).length ? { incomeDate: date } : {}),
    };
  }

  private includeRelations() {
    return {
      user: { select: { id: true, name: true, username: true, documentSuffix: true, role: true } },
      client: { select: { id: true, fullName: true, identityDocument: true } },
      voidedBy: { select: { id: true, name: true, username: true } },
    };
  }

  private serialize(row: any) {
    return {
      ...row,
      amount: decimalToNumber(row.amount),
    };
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private incomeTypeLabel(value: string) {
    return value === 'ADVANCE' ? 'Anticipo' : 'Pago a cartera';
  }

  private paymentMethodLabel(value: string) {
    return value === 'CASH' ? 'Efectivo' : 'Banco';
  }

  private statusLabel(value: string) {
    return value === 'ACTIVE' ? 'Activo' : 'Anulado';
  }
}
