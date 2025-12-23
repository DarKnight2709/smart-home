import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { UpdatePermissionNameDto } from './permission.dto';

@ApiTags('Permission')
@Controller('permissions')
export class PermissionController {

  constructor(
    private readonly permissionSevice: PermissionService
  ) {}


  // roles list
  @Get()
  @ApiOperation({
    summary: 'Danh sách quyền',
  })
  async getRoles() {
    return await this.permissionSevice.findAll();
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật tên quyền',
  })
  async updatePermissionName(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionNameDto,
  ) {
    return this.permissionSevice.updateName(id, dto);
  }
}
