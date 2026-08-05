import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePriceListProductDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  supplierId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reference: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  measure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  presentation?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(191)
  primaryPriceLabel: string;

  @IsString()
  @MinLength(2)
  @MaxLength(191)
  secondaryPriceLabel: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  primaryPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  secondaryPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  primaryPriceNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  secondaryPriceNote?: string;
}
