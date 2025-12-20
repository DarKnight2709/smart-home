import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BedroomService } from './bedroom.service';
import { BedRoomStateDto } from './bedroom.dto';

@Controller('bedroom')
export class BedroomController {
  constructor(private readonly bedroomService: BedroomService) {}

  @Get()
  getStatus() {
    return this.bedroomService.getStatus();
  }

  @Post('light')
  async controlLight(@Body('') body: BedRoomStateDto) {
    await this.bedroomService.controlLight(body.state);
    return { success: true, message: `Light turned ${body.state ? 'ON' : 'OFF'}` };
  }
}
