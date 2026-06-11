import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
