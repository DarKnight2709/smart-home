import { Module } from '@nestjs/common';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
