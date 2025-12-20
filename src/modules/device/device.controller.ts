import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { DeviceService } from './device.service'
import { UpsertDeviceDto } from './device.dto'

@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  async list(@Query('location') location?: string) {
    return this.deviceService.findAll(location)
  }

  @Post()
  async upsert(@Body() body: UpsertDeviceDto) {
    return this.deviceService.upsert(body)
  }
}