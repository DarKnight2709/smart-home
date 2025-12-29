import { Body, Controller, Get, Patch, Param } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { KitchenStateDto } from './kitchen.dto';
import { UpdateDeviceNameDto } from '../device/device.dto';

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('details')
  async getDetails() {
    return await this.kitchenService.getDetails();
  }

  @Patch('light/:deviceId')
  async controlSpecificLight(@Param('deviceId') deviceId: string, @Body() body: KitchenStateDto) {
    await this.kitchenService.controlSpecificLight(deviceId, body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} đèn ${deviceId}` };
  }


  @Patch('lights/control-all')
  async controlAllLights(@Body() body: KitchenStateDto) {
    await this.kitchenService.controlAllLights(body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} tất cả đèn` };
  }

  @Patch('window/:deviceId')
  async controlSpecificWindow(@Param('deviceId') deviceId: string, @Body() body: KitchenStateDto) {
    await this.kitchenService.controlSpecificWindow(deviceId, body.state);
    return { success: true, message: `Đã ${body.state ? 'mở' : 'đóng'} cửa ${deviceId}` };
  }

  @Patch('windows/control-all')
  async controlAllWindows(@Body() body: KitchenStateDto) {
    await this.kitchenService.controlAllWindows(body.state);
    return { success: true, message: `Đã ${body.state ? 'mở' : 'đóng'} tất cả cửa` };
  }

  @Patch('auto')
  async commandAuto(@Body() body: KitchenStateDto) {
    await this.kitchenService.commandAuto(body.state);
    return { success: true, message: `Đã ${body.state ? 'bật' : 'tắt'} chế độ tự động` };
  }

  @Patch('device/:deviceId/name')
  async updateDeviceName(@Param('deviceId') deviceId: string, @Body() body: UpdateDeviceNameDto) {
    return await this.kitchenService.updateDeviceName(deviceId, body.name);
  }
}
