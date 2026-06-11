import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.categories.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.categories.remove(user.userId, id);
  }
}
