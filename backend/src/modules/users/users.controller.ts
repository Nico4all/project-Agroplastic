import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.users.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateManagedUserDto) {
    return this.users.createManaged(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.users.updateManaged(user.userId, id, dto);
  }
}
