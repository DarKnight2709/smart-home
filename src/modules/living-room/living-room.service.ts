import { Injectable } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class LivingRoomService {
  constructor(private readonly mqttService: MqttService) {}

  getStatus() {
    return { status: 'Living room module is working!' };
  }

  async controlLight(state: boolean) {
    await this.mqttService.controlLight('living-room', state);
  }

  async controlDoor(state: boolean) {
    await this.mqttService.controlDoor('living-room', state);
  }
}
