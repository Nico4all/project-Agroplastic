import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const email = dto.email.toLowerCase().trim();
    const name = dto.name.trim();

    if (!name) throw new BadRequestException('El nombre es obligatorio');

    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException('Usuario no encontrado');

    if (email !== current.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) throw new ConflictException('El correo ya esta registrado');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contrasena debe ser diferente');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('La contrasena actual no es correcta');

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return { ok: true };
  }
}
