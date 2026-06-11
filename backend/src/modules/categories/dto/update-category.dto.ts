import { CategoryType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
