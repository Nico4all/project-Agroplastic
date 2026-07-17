import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsString()
  clientId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
