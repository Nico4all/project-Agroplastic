import { IsBoolean } from 'class-validator';

export class UpdateInvoicedStatusDto {
  @IsBoolean()
  isInvoiced!: boolean;
}
