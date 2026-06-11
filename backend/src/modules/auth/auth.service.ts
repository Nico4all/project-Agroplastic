import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmailCodePurpose, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { EmailDto, ResetPasswordDto, VerifyEmailCodeDto } from './dto/email-code.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('El correo ya esta registrado');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email, passwordHash },
    });

    return this.sendEmailCode(user, EmailCodePurpose.REGISTER);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Credenciales invalidas');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Credenciales invalidas');

    if (!user.emailVerifiedAt) {
      return this.sendEmailCode(user, EmailCodePurpose.REGISTER);
    }

    return this.issueSession(user);
  }

  async verifyRegistration(dto: VerifyEmailCodeDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Codigo invalido');

    await this.consumeEmailCode(user.id, EmailCodePurpose.REGISTER, dto.code);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt || new Date() },
    });

    return this.issueSession(updated);
  }

  async resendRegistrationCode(dto: EmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) return { ok: true };
    if (user.emailVerifiedAt) return { ok: true };
    await this.sendEmailCode(user, EmailCodePurpose.REGISTER);
    return { ok: true };
  }

  async requestPasswordChange(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contrasena debe ser diferente');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('La contrasena actual no es correcta');

    const newPasswordHash = await argon2.hash(dto.newPassword);
    return this.sendEmailCode(user, EmailCodePurpose.PASSWORD_CHANGE, newPasswordHash);
  }

  async confirmPasswordChange(userId: string, code: string) {
    const verification = await this.consumeEmailCode(userId, EmailCodePurpose.PASSWORD_CHANGE, code);
    if (!verification.newPasswordHash) throw new BadRequestException('Solicitud invalida');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: verification.newPasswordHash },
    });

    return { ok: true };
  }

  async requestPasswordReset(dto: EmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (user) await this.sendEmailCode(user, EmailCodePurpose.PASSWORD_RESET);
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Codigo invalido');

    await this.consumeEmailCode(user.id, EmailCodePurpose.PASSWORD_RESET, dto.code);

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }

  async refresh(cookieValue?: string) {
    const parsed = this.parseRefreshCookie(cookieValue);
    if (!parsed) throw new UnauthorizedException('Refresh token invalido');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    const valid = await argon2.verify(stored.tokenHash, parsed.secret);
    if (!valid) throw new UnauthorizedException('Refresh token invalido');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(stored.user);
  }

  async logout(cookieValue?: string) {
    const parsed = this.parseRefreshCookie(cookieValue);
    if (parsed) {
      await this.prisma.refreshToken.updateMany({
        where: { id: parsed.id },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  private async issueSession(user: User) {
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') || 'dev_access_secret',
        expiresIn: accessExpiresIn as any,
      },
    );

    const secret = randomBytes(48).toString('hex');
    const tokenHash = await argon2.hash(secret);
    const days = Number(this.config.get<string>('REFRESH_TOKEN_DAYS') || 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const stored = await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken: `${stored.id}.${secret}`,
      user: this.publicUser(user),
    };
  }

  private parseRefreshCookie(value?: string) {
    if (!value) return null;
    const [id, secret] = value.split('.');
    if (!id || !secret) return null;
    return { id, secret };
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private async sendEmailCode(user: User, purpose: EmailCodePurpose, newPasswordHash?: string) {
    const code = this.generateCode();
    const codeHash = await argon2.hash(code);
    const ttlMinutes = Number(this.config.get<string>('EMAIL_CODE_TTL_MINUTES') || 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.emailVerificationCode.updateMany({
      where: { userId: user.id, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const verification = await this.prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        email: user.email,
        purpose,
        codeHash,
        newPasswordHash,
        expiresAt,
      },
    });

    await this.email.sendVerificationCode(user.email, code, purpose, ttlMinutes);

    return {
      requiresEmailVerification: true,
      challengeId: verification.id,
      email: user.email,
      purpose,
      expiresAt,
    };
  }

  private async consumeEmailCode(userId: string, purpose: EmailCodePurpose, code: string) {
    const verification = await this.prisma.emailVerificationCode.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new UnauthorizedException('El codigo expiro o no es valido');
    }

    if (verification.attempts >= 5) {
      await this.prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException('Demasiados intentos. Solicita otro codigo');
    }

    const valid = await argon2.verify(verification.codeHash, code);
    if (!valid) {
      await this.prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Codigo invalido');
    }

    return this.prisma.emailVerificationCode.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });
  }

  private generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
