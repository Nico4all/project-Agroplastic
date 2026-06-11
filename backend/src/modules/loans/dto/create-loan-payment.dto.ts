import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateLoanPaymentDto {
  @IsString()
  accountId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
