import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class EmailDto {
  @IsEmail()
  email: string;
}

export class VerifyEmailCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class ConfirmPasswordChangeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
