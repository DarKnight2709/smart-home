import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdatePermissionNameDto {
  @ApiProperty({
    description: 'Tên quyền mới',
    example: 'GET /users',
  })
  @IsString()
  name: string;
}
