import { Entity, Column } from 'typeorm';
import { AuditableEntity } from '../base/base.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('settings')
export class SettingEntity extends AuditableEntity {
  @ApiProperty({
    description: 'Loại sensor (temperature, humidity, gas...)',
    example: 'temperature',
  })
  @Column({
    name: 'sensor_type',
    type: 'varchar',
    length: 50,
    comment: 'Loại sensor (temperature, humidity, gas…)',
  })
  sensorType: string;

  @ApiProperty({
    description: 'Giá trị min cảnh báo',
    example: 18.5,
  })
  @Column({
    name: 'min_value',
    type: 'float',
    comment: 'Giá trị min cảnh báo',
  })
  minValue: number;

  @ApiProperty({
    description: 'Giá trị max cảnh báo',
    example: 30.0,
  })
  @Column({
    name: 'max_value',
    type: 'float',
    comment: 'Giá trị max cảnh báo',
  })
  maxValue: number;
}

