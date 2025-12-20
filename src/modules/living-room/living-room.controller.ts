import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { LivingRoomService } from './living-room.service';
import { LivingRoomStateDto } from './living-room.dto';

@Controller('living-room')
export class LivingRoomController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Get()
  getStatus() {
    return this.livingRoomService.getStatus();
  }

  @Post('light')
  async controlLight(@Body() body: LivingRoomStateDto) {
    await this.livingRoomService.controlLight(body.state);
    return { success: true, message: `Light turned ${body.state ? 'ON' : 'OFF'}` };
  }

  @Post('door')
  async controlDoor(@Body() body: LivingRoomStateDto) {
    await this.livingRoomService.controlDoor(body.state);
    return { success: true, message: `Door ${body.state ? 'UNLOCK' : 'LOCK'}` };
  }
}
