import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateInventoryTransferItemDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}

export class CreateInventoryTransferDto {
  @IsString()
  originPointOfSaleId: string;

  @IsString()
  destinationPointOfSaleId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryTransferItemDto)
  items: CreateInventoryTransferItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
