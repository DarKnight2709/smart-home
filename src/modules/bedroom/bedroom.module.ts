import { Module } from '@nestjs/common';
import { BedroomController } from './bedroom.controller';
import { BedroomService } from './bedroom.service';
import { MqttModule } from '../mqtt/mqtt.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [MqttModule, DeviceModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity])
  ],
  controllers: [BedroomController],
  providers: [BedroomService],
  exports: [BedroomService],
})
export class BedroomModule {}
