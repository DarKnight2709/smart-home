import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Tên vai trò',
    example: 'ADMIN',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Mô tả vai trò',
    example: 'Quản trị hệ thống',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Danh sách ID quyền",
    type: [String],
    required: false,
    example: [
      '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    ]
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })  
  permissionIds?: string[]
}

export class UpdateRoleDto {

  @ApiPropertyOptional({
    description: 'Tên vai trò',
    example: 'ADMIN',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Mô tả vai trò',
    example: 'Quản trị hệ thống',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Danh sách ID quyền",
    type: [String],
    example: [
      '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    ]
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })  
  permissionIds?: string[];
}



export class GetRolesQueryDto {
  @ApiProperty({
    description: 'Số trang',
    example: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Số lượng bản ghi trên một trang',
    example: 10,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;


  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true' || val === '1' || val === 'yes') return true;
    if (val === 'false' || val === '0' || val === 'no') return false;
    return val;
  })
  @IsBoolean()
  isSystemRole?: boolean;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true' || val === '1' || val === 'yes') return true;
    if (val === 'false' || val === '0' || val === 'no') return false;
    return val;
  })
  @IsBoolean()
  isActive?: boolean;
}
