import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateInventoryEntryItemDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}

export class CreateInventoryEntryDto {
  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(191)
  supplierName: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  remittanceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @IsDateString()
  entryDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryEntryItemDto)
  items: CreateInventoryEntryItemDto[];
}
