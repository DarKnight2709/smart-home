import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionService } from './permission.service';

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
}
