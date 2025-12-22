import { Module } from '@nestjs/common';
import { LivingRoomController } from './living-room.controller';
import { LivingRoomService } from './living-room.service';
import { MqttModule } from '../mqtt/mqtt.module';
import { DeviceModule } from '../device/device.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';

@Module({
  imports: [MqttModule, DeviceModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity])
  ],
  controllers: [LivingRoomController],
  providers: [LivingRoomService],
  exports: [LivingRoomService],
})
export class LivingRoomModule {}
