import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdatePriceListProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  measure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  presentation?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  primaryPriceLabel?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  secondaryPriceLabel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
