import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  accountId: string;

  @IsString()
  categoryId: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
