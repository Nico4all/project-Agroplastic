import { AccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
