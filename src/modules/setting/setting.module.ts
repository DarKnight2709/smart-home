import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingEntity } from '../../database/entities/setting.entity';
import { SettingService } from './setting.service';
import { SettingController } from './setting.controller';
import { SecuritySettingEntity } from '../../database/entities/security-setting.entity';
import { SecuritySettingService } from './security-setting.service';

@Module({
  imports: [TypeOrmModule.forFeature([SettingEntity, SecuritySettingEntity])],
  controllers: [SettingController],
  providers: [SettingService, SecuritySettingService],
  exports: [SettingService, SecuritySettingService],
})
export class SettingModule {}

