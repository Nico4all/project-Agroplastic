import { IncomeType, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateIncomeDto {
  @IsString()
  clientId: string;

  @IsEnum(IncomeType)
  type: IncomeType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  incomeDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
