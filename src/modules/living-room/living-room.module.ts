import { Module } from '@nestjs/common';
import { LivingRoomController } from './living-room.controller';
import { LivingRoomService } from './living-room.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [LivingRoomController],
  providers: [LivingRoomService],
  exports: [LivingRoomService],
})
export class LivingRoomModule {}
