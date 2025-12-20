import { IsString, IsOptional, IsIn, IsArray, IsEnum } from 'class-validator'
import { DeviceStatus, DeviceType } from 'src/shared/enums/device.enum'

export class UpsertDeviceDto {
  @IsString()
  id: string

  @IsString()
  name: string

  @IsEnum(DeviceType)
  type: DeviceType


  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  lastState?: string

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;
}