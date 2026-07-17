import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, User, UserRole } from '@prisma/client';
import { decimalToNumber } from '../../common/helpers/money';
import { buildExcelHtml, buildSimplePdf, formatDate, formatMoney } from '../../common/helpers/reports';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { VoidExpenseDto } from './dto/void-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(userId: string, query: QueryExpensesDto) {
    const actor = await this.users.getActiveUser(userId);
    const where = this.buildWhere(actor, query);
    const [total, data, grouped] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: this.includeRelations(),
        orderBy: { expenseDate: query.sort },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.expense.groupBy({
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

  async create(userId: string, dto: CreateExpenseDto) {
    const actor = await this.users.getActiveUser(userId);
    const category = await this.prisma.expenseCategory.findFirst({ where: { id: dto.categoryId, isActive: true } });
    if (!category) throw new BadRequestException('Categoria no encontrada o inactiva');

    const city = this.resolveCity(actor, dto.city);
    const expense = await this.prisma.expense.create({
      data: {
        userId: actor.id,
        categoryId: category.id,
        city,
        paidTo: dto.paidTo.trim(),
        amount: new Prisma.Decimal(dto.amount),
        description: dto.description?.trim() || null,
        approvedBy: dto.approvedBy?.trim() || actor.name,
        expenseDate: new Date(dto.expenseDate),
      },
      include: this.includeRelations(),
    });

    return this.serialize(expense);
  }

  async void(userId: string, id: string, dto: VoidExpenseDto) {
    const actor = await this.users.getActiveUser(userId);
    const current = await this.findAccessible(actor, id);
    if (current.status === RecordStatus.VOID) return this.serialize(current);

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        voidReason: dto.reason?.trim() || null,
        voidedAt: new Date(),
        voidedByUserId: actor.id,
      },
      include: this.includeRelations(),
    });

    return this.serialize(updated);
  }

  async exportExcel(userId: string, query: QueryExpensesDto) {
    const rows = await this.findRowsForExport(userId, query);
    return buildExcelHtml(
      'Listado de egresos',
      ['Fecha', 'Ciudad', 'Usuario', 'Categoria', 'Pagado a', 'Valor', 'Estado', 'Aprobado por', 'Descripcion'],
      rows.map((row) => [
        formatDate(row.expenseDate),
        row.city,
        row.user.name,
        row.category.name,
        row.paidTo,
        decimalToNumber(row.amount),
        this.statusLabel(row.status),
        row.approvedBy || '',
        row.description || '',
      ]),
    );
  }

  async exportPdf(userId: string, query: QueryExpensesDto) {
    const rows = await this.findRowsForExport(userId, query);
    const total = rows
      .filter((row) => row.status === RecordStatus.ACTIVE)
      .reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
    const lines = [
      `Total activo: ${formatMoney(total)}`,
      `Registros: ${rows.length}`,
      '',
      ...rows.slice(0, 42).map((row) =>
        `${formatDate(row.expenseDate)} | ${row.city} | ${row.user.name} | ${row.category.name} | ${row.paidTo} | ${formatMoney(decimalToNumber(row.amount))} | ${this.statusLabel(row.status)}`,
      ),
    ];
    return buildSimplePdf('Listado de egresos', lines);
  }

  async receiptPdf(userId: string, id: string) {
    const actor = await this.users.getActiveUser(userId);
    const expense = await this.findAccessible(actor, id);
    const lines = [
      `Ciudad: ${expense.city}`,
      `Fecha: ${formatDate(expense.expenseDate)}`,
      `No - Id: ${expense.id}`,
      `Pagado A: ${expense.paidTo}`,
      `Valor: ${formatMoney(decimalToNumber(expense.amount))}`,
      `Categoria: ${expense.category.name}`,
      `Descripcion: ${expense.description || ''}`,
      `Aprobado por: ${expense.approvedBy || expense.user.name}`,
      `Estado: ${this.statusLabel(expense.status)}`,
      expense.status === RecordStatus.VOID ? `Anulado: ${expense.voidReason || 'Sin motivo'}` : '',
    ].filter(Boolean);
    return buildSimplePdf('Recibo de caja menor', lines);
  }

  private async findAccessible(actor: User, id: string) {
    const row = await this.prisma.expense.findFirst({
      where: { id, ...(actor.role === UserRole.ADMIN ? {} : { userId: actor.id }) },
      include: this.includeRelations(),
    });
    if (!row) throw new NotFoundException('Egreso no encontrado');
    return row;
  }

  private async findRowsForExport(userId: string, query: QueryExpensesDto) {
    const actor = await this.users.getActiveUser(userId);
    return this.prisma.expense.findMany({
      where: this.buildWhere(actor, query),
      include: this.includeRelations(),
      orderBy: { expenseDate: query.sort || 'desc' },
      take: 5000,
    });
  }

  private buildWhere(actor: User, query: QueryExpensesDto): Prisma.ExpenseWhereInput {
    const and: Prisma.ExpenseWhereInput[] = [];
    if (actor.role !== UserRole.ADMIN) and.push({ userId: actor.id });
    if (query.search) {
      and.push({
        OR: [
          { description: { contains: query.search } },
          { paidTo: { contains: query.search } },
          { approvedBy: { contains: query.search } },
          { city: { contains: query.search } },
          { category: { name: { contains: query.search } } },
        ],
      });
    }

    const date: Prisma.DateTimeFilter = {};
    if (query.fromDate) date.gte = new Date(query.fromDate);
    if (query.toDate) date.lte = this.endOfDay(query.toDate);

    return {
      ...(and.length ? { AND: and } : {}),
      ...(actor.role === UserRole.ADMIN && query.userId ? { userId: query.userId } : {}),
      ...(actor.role === UserRole.ADMIN && query.city ? { city: query.city } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(Object.keys(date).length ? { expenseDate: date } : {}),
    };
  }

  private resolveCity(actor: User, requested?: string) {
    if (actor.role === UserRole.ADMIN) {
      const city = requested?.trim() || actor.city;
      if (!city) throw new BadRequestException('La ciudad es obligatoria');
      return city;
    }

    if (!actor.city) throw new BadRequestException('El usuario de bodega no tiene ciudad asignada');
    return actor.city;
  }

  private includeRelations() {
    return {
      user: { select: { id: true, name: true, username: true, city: true, role: true } },
      category: { select: { id: true, name: true } },
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

  private statusLabel(value: string) {
    return value === 'ACTIVE' ? 'Activo' : 'Anulado';
  }
}
