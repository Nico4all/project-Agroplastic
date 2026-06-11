import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ConfirmPasswordChangeDto, EmailDto, ResetPasswordDto, VerifyEmailCodeDto } from './dto/email-code.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto);
    return this.withOptionalSessionCookie(res, result);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    return this.withOptionalSessionCookie(res, result);
  }

  @Post('verify-registration')
  @HttpCode(200)
  async verifyRegistration(@Body() dto: VerifyEmailCodeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyRegistration(dto);
    return this.withOptionalSessionCookie(res, result);
  }

  @Post('resend-registration-code')
  @HttpCode(200)
  resendRegistrationCode(@Body() dto: EmailDto) {
    return this.auth.resendRegistrationCode(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
    this.setRefreshCookie(res, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { userId: string }) {
    return this.users.me(user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: { userId: string }, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  changePassword(@CurrentUser() user: { userId: string }, @Body() dto: ChangePasswordDto) {
    return this.auth.requestPasswordChange(user.userId, dto);
  }

  @Post('password/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  confirmPasswordChange(@CurrentUser() user: { userId: string }, @Body() dto: ConfirmPasswordChangeDto) {
    return this.auth.confirmPasswordChange(user.userId, dto.code);
  }

  @Post('password/forgot')
  @HttpCode(200)
  forgotPassword(@Body() dto: EmailDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Post('password/reset')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  private setRefreshCookie(res: Response, token: string) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const days = Number(this.config.get<string>('REFRESH_TOKEN_DAYS') || 7);
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;

    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      domain,
      maxAge: days * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private withOptionalSessionCookie(res: Response, result: any) {
    if (!result.refreshToken) return result;
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }
}
