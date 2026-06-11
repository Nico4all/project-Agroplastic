import { CategoryType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}
