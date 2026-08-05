import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name: string;
}
