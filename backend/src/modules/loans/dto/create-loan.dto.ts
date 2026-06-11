import { LoanType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateLoanDto {
  @IsEnum(LoanType)
  type: LoanType;

  @IsString()
  accountId: string;

  @IsString()
  @MaxLength(120)
  personName: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  principalAmount: number;

  @IsDateString()
  loanDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}
