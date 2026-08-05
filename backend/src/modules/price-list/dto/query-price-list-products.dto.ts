import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class QueryPriceListProductsDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  pointOfSaleId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
