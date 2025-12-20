import { Injectable } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class BedroomService {
  constructor(private readonly mqttService: MqttService) {}

  getStatus() {
    return { status: 'Bedroom module is working!' };
  }

  async controlLight(state: boolean) {
    await this.mqttService.controlLight('bedroom', state);
  }
}
