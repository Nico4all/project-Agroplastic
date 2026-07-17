import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  identityDocument: string;

}
