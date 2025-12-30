import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateHomeInfoDto {
  @ApiProperty({
    description: 'Tên nhà',
    required: false,
    example: 'My Smart Home',
  })
  @IsOptional()
  @IsString()
  homeName?: string;

  @ApiProperty({
    description: 'Địa chỉ nhà',
    required: false,
    example: '123 Main St, District 1',
  })
  @IsOptional()
  @IsString()
  homeAddress?: string;
}

export class UpdateSecuritySettingDto {
  @ApiProperty({
    description: 'Giá trị setting (luôn lưu dạng string trong DB)',
    example: '5',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({
    description: 'Mô tả setting',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Kiểu dữ liệu của setting',
    example: 'number',
    required: false,
    enum: ['string', 'number', 'boolean', 'json'],
  })
  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'json'])
  valueType?: 'string' | 'number' | 'boolean' | 'json';
}
