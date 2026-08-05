import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePriceListProductDto {
  @IsOptional()
  @IsUUID()
  pointOfSaleId?: string;

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

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  primaryPrice?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  secondaryPrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  primaryPriceNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  secondaryPriceNote?: string | null;
}
