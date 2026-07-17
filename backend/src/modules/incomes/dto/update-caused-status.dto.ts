import { IsBoolean } from 'class-validator';

export class UpdateCausedStatusDto {
  @IsBoolean()
  isCaused!: boolean;
}
