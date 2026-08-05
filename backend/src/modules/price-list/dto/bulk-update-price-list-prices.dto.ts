import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkUpdatePriceListPriceDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  primaryPrice?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  secondaryPrice?: number | null;
}

export class BulkUpdatePriceListPricesDto {
  @IsUUID()
  pointOfSaleId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdatePriceListPriceDto)
  updates!: BulkUpdatePriceListPriceDto[];
}
