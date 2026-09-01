import { Type } from 'class-transformer';
import { InventoryAdjustmentOperation } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export { InventoryAdjustmentOperation };

export class CreateInventoryAdjustmentDto {
  @IsString()
  pointOfSaleId: string;

  @IsString()
  productId: string;

  @IsEnum(InventoryAdjustmentOperation)
  operation: InventoryAdjustmentOperation;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
