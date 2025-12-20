// overview.dto.ts
import { IsBoolean } from 'class-validator';
import { DeviceStatus, DeviceType } from '../../shared/enums/device.enum';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceOverviewDto {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  lastState: string;
  status: DeviceStatus;
}

export class OverviewResponseDto {
  devices: DeviceOverviewDto[];
}

export class OverviewStateDto {
  @ApiProperty({ example: true})
  @IsBoolean()
  state: boolean;
}
