import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { LivingRoomService } from './living-room.service';
import { LivingRoomStateDto, ChangeDoorPasswordDto } from './living-room.dto';
import { UpdateDeviceNameDto } from '../device/device.dto';

@Controller('living-room')
export class LivingRoomController {
  constructor(private readonly livingRoomService: LivingRoomService) {}


  @Get("details")
  async getDetails() {
    return await this.livingRoomService.getDetails();
  }


  @Patch('light/:deviceId')
  async controlSpecificLight(@Param('deviceId') deviceId: string, @Body() body: LivingRoomStateDto) {
    await this.livingRoomService.controlSpecificLight(deviceId, body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} đèn ${deviceId}` };
  }



  @Patch('lights/control-all')
  async controlAllLights(@Body() body: LivingRoomStateDto) {
    await this.livingRoomService.controlAllLights(body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} tất cả đèn` };
  }

  @Patch('door/:deviceId')
  async controlSpecificDoor(@Param('deviceId') deviceId: string, @Body() body: LivingRoomStateDto) {
    await this.livingRoomService.controlSpecificDoor(deviceId, body.state);
    return { success: true, message: `Đã ${body.state ? 'mở' : 'đóng'} cửa ${deviceId}` };
  }

  @Patch('doors/control-all')
  async controlAllDoors(@Body() body: LivingRoomStateDto) {
    await this.livingRoomService.controlAllDoors(body.state);
    return { success: true, message: `Đã ${body.state ? 'mở' : 'đóng'} tất cả cửa` };
  }

  @Patch('door/:deviceId/change-password')
  async changeDoorPassword(@Param('deviceId') deviceId: string, @Body() body: ChangeDoorPasswordDto) {
    return await this.livingRoomService.changeDoorPassword(deviceId, body);
  }

  @Patch('device/:deviceId/name')
  async updateDeviceName(@Param('deviceId') deviceId: string, @Body() body: UpdateDeviceNameDto) {
        console.log("Updating device name:", deviceId, body.name);

    return await this.livingRoomService.updateDeviceName(deviceId, body.name);
  }
}
