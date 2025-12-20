import { Module } from '@nestjs/common';
import { BedroomController } from './bedroom.controller';
import { BedroomService } from './bedroom.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [BedroomController],
  providers: [BedroomService],
  exports: [BedroomService],
})
export class BedroomModule {}
