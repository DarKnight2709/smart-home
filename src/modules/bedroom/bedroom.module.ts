import { Module } from '@nestjs/common';
import { BedroomController } from './bedroom.controller';
import { BedroomService } from './bedroom.service';
import { MqttModule } from '../mqtt/mqtt.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { DeviceModule } from '../device/device.module';
import { Device } from 'src/database/entities/device.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    MqttModule,
    DeviceModule,
    AuditLogModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity, Device]),
  ],
  controllers: [BedroomController],
  providers: [BedroomService],
  exports: [BedroomService],
})
export class BedroomModule {}
