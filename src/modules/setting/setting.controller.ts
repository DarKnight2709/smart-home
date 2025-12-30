import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
} from '@nestjs/common';
import { ApiParam, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './setting.dto';
import { SecuritySettingEntity } from 'src/database/entities/security-setting.entity';
import { UpdateHomeInfoDto, UpdateSecuritySettingDto } from './security-setting.dto';
import { SecuritySettingService } from './security-setting.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingController {
  constructor(
    private readonly settingService: SettingService,
    private readonly securitySettingService: SecuritySettingService,
  ) {}


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


  @Get('security')
  @ApiOperation({ summary: 'Lấy danh sách security settings' })
  @ApiResponse({ status: 200, type: [SecuritySettingEntity] })
  async findAllSecuritySettings(): Promise<SecuritySettingEntity[]> {
    return await this.securitySettingService.findAll();
  }

  @Get('home-info')
  @ApiOperation({ summary: 'Lấy thông tin nhà (home_name + home_address)' })
  async getHomeInfo() {
    return await this.settingService.getHomeInfo();
  }

  @Patch('home-info')
  @ApiOperation({ summary: 'Cập nhật thông tin nhà (home_name + home_address)' })
  async updateHomeInfo(@Body() body: UpdateHomeInfoDto) {
    return await this.settingService.updateHomeInfo(body);
  }

  @Get('security/:key')
  @ApiOperation({ summary: 'Lấy 1 security setting theo key' })
  @ApiParam({ name: 'key', example: 'max_door_password_attempts' })
  @ApiResponse({ status: 200, type: SecuritySettingEntity })
  async findOneSecuritySetting(
    @Param('key') key: string,
  ): Promise<SecuritySettingEntity | null> {
    return await this.securitySettingService.getSetting(key);
  }

  @Patch('security/:key')
  @ApiOperation({ summary: 'Cập nhật security setting theo key' })
  @ApiParam({ name: 'key', example: 'max_door_password_attempts' })
  async updateSecuritySetting(
    @Param('key') key: string,
    @Body() body: UpdateSecuritySettingDto,
  ): Promise<SecuritySettingEntity> {
    return await this.securitySettingService.updateSetting(
      key,
      body.value,
      body.description,
      body.valueType,
    );
  }


}

