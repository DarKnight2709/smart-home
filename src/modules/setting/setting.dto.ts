import { IsString, IsNumber, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SensorRangeDto {
  @ApiPropertyOptional({ example: 18 })
  @IsNumber()
  min: number;

  @ApiPropertyOptional({ example: 30 })
  @IsNumber()
  max: number;
}

export class UpdateSettingDto {
  @ApiPropertyOptional({ type: SensorRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SensorRangeDto)
  temperature?: SensorRangeDto;

  @ApiPropertyOptional({ type: SensorRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SensorRangeDto)
  humidity?: SensorRangeDto;

  @ApiPropertyOptional({ type: SensorRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SensorRangeDto)
  gas?: SensorRangeDto;
}

export class SettingResponseDto {
  sensorType: string;
  min: number;
  max: number;
}
