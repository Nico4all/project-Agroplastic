import { Type } from 'class-transformer';
import { OrderPaymentMethod } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

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

export class CreateOrderPaymentDto {
  @IsEnum(OrderPaymentMethod)
  method: OrderPaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}

export class CreateOrderDto {
  @IsString()
  clientId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  deliveryAddress: string;

  @IsString()
  @MinLength(7)
  @MaxLength(50)
  clientPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPaymentDto)
  payments: CreateOrderPaymentDto[];
}
