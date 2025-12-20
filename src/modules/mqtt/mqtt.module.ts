import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { SharedModule } from '../../shared/shared.module';
import { DeviceModule } from '../device/device.module';

@Global()
@Module({
  imports: [SharedModule, DeviceModule],
  providers: [MqttService],
  controllers: [MqttController],
  exports: [MqttService], // Export để dùng ở module khác
})
export class MqttModule {}