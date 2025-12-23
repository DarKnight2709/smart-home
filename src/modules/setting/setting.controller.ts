import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './setting.dto';
import { SettingEntity } from '../../database/entities/setting.entity';

@ApiTags('Settings')
@Controller('settings')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}


  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả settings' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách settings',
  })
  async findAll() {
    return this.settingService.findAll();
  }


  @Patch()
  @ApiOperation({ summary: 'Cập nhật setting' })
  @ApiResponse({
    status: 200,
    description: 'Setting đã được cập nhật thành công',
  })
  @ApiResponse({ status: 404, description: 'Setting không tồn tại' })
  async update(
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return this.settingService.update( updateSettingDto);
  }


}

