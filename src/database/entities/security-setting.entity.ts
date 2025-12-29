import { Entity, Column } from 'typeorm';
import { AuditableEntity } from '../base/base.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('security_settings')
export class SecuritySettingEntity extends AuditableEntity {
  @ApiProperty({
    description: 'Tên cài đặt',
    example: 'max_door_password_attempts',
  })
  @Column({
    name: 'setting_key',
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'Tên cài đặt (unique key)',
  })
  settingKey: string;

  @ApiProperty({
    description: 'Giá trị cài đặt',
    example: '5',
  })
  @Column({
    name: 'setting_value',
    type: 'varchar',
    length: 500,
    comment: 'Giá trị cài đặt',
  })
  settingValue: string;

  @ApiProperty({
    description: 'Mô tả cài đặt',
    example: 'Số lần nhập sai mật khẩu tối đa trước khi cảnh báo',
  })
  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
    comment: 'Mô tả cài đặt',
  })
  description?: string;

  @ApiProperty({
    description: 'Loại dữ liệu',
    example: 'number',
  })
  @Column({
    name: 'value_type',
    type: 'enum',
    enum: ['string', 'number', 'boolean', 'json'],
    default: 'string',
    comment: 'Loại dữ liệu của giá trị',
  })
  valueType: 'string' | 'number' | 'boolean' | 'json';
}
