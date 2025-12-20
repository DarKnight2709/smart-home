import { Controller, Get, Post, Body } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { KitchenStateDto } from './kitchen.dto';

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get()
  getStatus() {
    return this.kitchenService.getStatus();
  }

  @Post('light')
  async controlLight(@Body() body: KitchenStateDto) {
    await this.kitchenService.controlLight(body.state);
    return { success: true, message: `Light turned ${body.state ? 'ON' : 'OFF'}` };
  }

  @Post('door')
  async controlDoor(@Body() body: KitchenStateDto) {
    await this.kitchenService.controlDoor(body.state);
    return { success: true, message: `Door ${body.state ? 'UNLOCK' : 'LOCK'}` };
  }
}
