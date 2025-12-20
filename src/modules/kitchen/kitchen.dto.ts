import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class KitchenStateDto {
  @ApiProperty({ example: true, description: 'Trạng thái của phòng bếp' })
  @IsBoolean()
  state: boolean;
}
