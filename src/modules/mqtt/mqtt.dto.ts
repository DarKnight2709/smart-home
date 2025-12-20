// dto/control-light.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ControlStatusDto {
  @ApiProperty({ example: true, description: 'Trạng thái của đèn' })
  @IsBoolean()
  state: boolean;
}