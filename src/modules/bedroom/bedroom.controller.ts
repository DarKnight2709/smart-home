import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { BedroomService } from './bedroom.service';
import { BedRoomStateDto, ChangeDoorPasswordDto } from './bedroom.dto';
import { UpdateDeviceNameDto } from '../device/device.dto';

@Controller('bedroom')
export class BedroomController {
  constructor(private readonly bedroomService: BedroomService) {}

  @Get("details")
  async getDetails() {
    return await this.bedroomService.getDetails();
  }


  @Patch('light/:deviceId')
  async controlSpecificLight(@Param('deviceId') deviceId: string, @Body() body: BedRoomStateDto) {
    await this.bedroomService.controlSpecificLight(deviceId, body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} đèn ${deviceId}` };
  }

  @Patch('lights/control-all')
  async controlAllLights(@Body() body: BedRoomStateDto) {
    await this.bedroomService.controlAllLights(body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} tất cả đèn` };
  }

  @Patch('door/:deviceId')
  async controlSpecificDoor(@Param('deviceId') deviceId: string, @Body() body: BedRoomStateDto) {
    await this.bedroomService.controlSpecificDoor(deviceId, body.state);
    return { success: true, message: `Đã ${body.state ? 'mở' : 'đóng'} cửa ${deviceId}` };
  }

  @Patch('doors/control-all')
  async controlAllDoors(@Body() body: BedRoomStateDto) {
    await this.bedroomService.controlAllDoors(body.state);
    return { success: true, message: `Đã ${body.state ? 'mở' : 'đóng'} tất cả cửa` };
  }

  @Patch('door/:deviceId/change-password')
  async changeDoorPassword(@Param('deviceId') deviceId: string, @Body() body: ChangeDoorPasswordDto) {
    return await this.bedroomService.changeDoorPassword(deviceId, body);
  }

  @Patch('device/:deviceId/name')
  async updateDeviceName(@Param('deviceId') deviceId: string, @Body() body: UpdateDeviceNameDto) {
    return await this.bedroomService.updateDeviceName(deviceId, body.name);
  }
}
