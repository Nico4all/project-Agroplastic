import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';

export enum InventoryAdjustmentOperation {
  ADD = 'ADD',
  SUBTRACT = 'SUBTRACT',
}

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
}
