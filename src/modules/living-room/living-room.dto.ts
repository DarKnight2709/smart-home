import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LivingRoomStateDto {
  @ApiProperty({ example: true, description: 'Trạng thái của phòng khách' })
  @IsBoolean()
  state: boolean;
}