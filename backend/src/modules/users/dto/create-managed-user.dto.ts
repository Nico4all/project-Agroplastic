import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateManagedUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  pointOfSaleId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  documentSuffix: string;
}
