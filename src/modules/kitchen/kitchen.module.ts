import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { MqttModule } from '../mqtt/mqtt.module';
import { DeviceModule } from '../device/device.module';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { Device } from 'src/database/entities/device.entity';

@Module({
  imports: [
    MqttModule,
    DeviceModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity, Device]),
  ],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
