import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BedRoomStateDto {
  @ApiProperty({ example: true, description: 'Trạng thái của phòng ngủ' })
  @IsBoolean()
  state: boolean;
}