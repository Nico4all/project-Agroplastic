import { LoanStatus, LoanType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryLoansDto {
  @IsOptional()
  @IsEnum(LoanType)
  type?: LoanType;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
