import { AccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialBalance = 0;
}
