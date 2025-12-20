import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../../database/entities/device.entity'
import { DeviceService } from './device.service'
import { DeviceController } from './device.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [DeviceService],
  controllers: [DeviceController],
  exports: [DeviceService],
})
export class DeviceModule {}