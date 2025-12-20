import { Controller, Post, Body, Param, Get, HttpException, HttpStatus } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { ControlStatusDto } from './mqtt.dto';

@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('devices/:deviceId/light')
  async controlLight(
    @Param('deviceId') deviceId: string, 
    @Body() body: ControlStatusDto
  ) {
    try {
      await this.mqttService.controlLight('living-room', body.state);
      return { 
        success: true, 
        message: `Light turned ${body.state ? 'ON' : 'OFF'}`,
        deviceId,
        state: body.state
      };
    } catch (error) {
      throw new HttpException(
        `Failed to control light: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('devices/:deviceId/door')
  async controlDoor(
    @Param('deviceId') deviceId: string, 
    @Body() body: ControlStatusDto
  ) {
    try {
      await this.mqttService.controlDoor('living-room', body.state);
      return { 
        success: true, 
        message: `Door ${body.state ? 'OPENED' : 'CLOSED'}`,
        deviceId,
        state: body.state
      };
    } catch (error) {
      throw new HttpException(
        `Failed to control door: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  getStatus() {
    return {
      connected: this.mqttService.isConnected(),
      brokerUrl: this.mqttService['brokerUrl']
    };
  }
}