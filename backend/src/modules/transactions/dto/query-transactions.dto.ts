import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

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
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}
