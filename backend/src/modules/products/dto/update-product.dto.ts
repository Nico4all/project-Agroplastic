import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
