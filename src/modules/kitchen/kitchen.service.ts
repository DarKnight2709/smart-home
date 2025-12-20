import { Injectable } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class KitchenService {
  constructor(private readonly mqttService: MqttService) {}

  getStatus() {
    return { status: 'Kitchen module is working!' };
  }

  async controlLight(state: boolean) {
    await this.mqttService.controlLight('kitchen', state);
  }

  async controlDoor(state: boolean) {
    await this.mqttService.controlDoor('kitchen', state);
  }
}
