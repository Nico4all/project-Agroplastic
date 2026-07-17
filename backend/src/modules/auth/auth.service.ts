import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    await this.ensureBootstrapAdmin();

    const username = this.normalizeUsername(dto.username);
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales invalidas');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Credenciales invalidas');

    return this.issueSession(user);
  }

  async refresh(cookieValue?: string) {
    const parsed = this.parseRefreshCookie(cookieValue);
    if (!parsed) throw new UnauthorizedException('Refresh token invalido');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
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
      { sub: user.id, username: user.username, role: user.role },
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
      username: user.username,
      role: user.role,
      documentSuffix: user.documentSuffix,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }

  private async ensureBootstrapAdmin() {
    const username = this.normalizeUsername(this.config.get<string>('ADMIN_USERNAME') || 'admin');
    const password = this.config.get<string>('ADMIN_PASSWORD') || 'admin12345';
    const name = this.config.get<string>('ADMIN_NAME') || 'Administrador';
    const documentSuffix = this.config.get<string>('ADMIN_DOCUMENT_SUFFIX') || 'ADMIN';
    const email = `${username}@local.agroplastic`;

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      const passwordMatches = await argon2.verify(existing.passwordHash, password);
      const passwordHash = passwordMatches ? existing.passwordHash : await argon2.hash(password);

      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name || name,
          role: UserRole.ADMIN,
          isActive: true,
          passwordHash,
          documentSuffix: existing.documentSuffix || documentSuffix,
          emailVerifiedAt: existing.emailVerifiedAt || new Date(),
        },
      });
      return;
    }

    const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount > 0) return;

    const passwordHash = await argon2.hash(password);

    await this.prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role: UserRole.ADMIN,
        documentSuffix,
        emailVerifiedAt: new Date(),
      },
    });
  }
}
