import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

const DEFAULT_EXPENSE_CATEGORIES = ['Descargue', 'Papeleria', 'Transporte', 'Aux de bodega'];

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll() {
    await this.ensureDefaults();
    return this.prisma.expenseCategory.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateExpenseCategoryDto) {
    await this.users.getActiveUser(userId);
    await this.ensureDefaults();

    try {
      return await this.prisma.expenseCategory.create({
        data: { name: dto.name.trim(), createdByUserId: userId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('La categoria ya existe');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateExpenseCategoryDto) {
    await this.users.ensureAdmin(userId);
    await this.ensureDefaults();
    const current = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Categoria no encontrada');

    try {
      return await this.prisma.expenseCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('La categoria ya existe');
      }
      throw error;
    }
  }

  private async ensureDefaults() {
    const existingCount = await this.prisma.expenseCategory.count();
    if (existingCount > 0) return;

    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
}
