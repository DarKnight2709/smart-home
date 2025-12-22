import { RoomSensorSnapshotEntity } from './../../database/entities/sensor-data.entity';
import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { SharedModule } from '../../shared/shared.module';
import { DeviceModule } from '../device/device.module';
import { SocketModule } from '../socket/socket.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [SharedModule, DeviceModule, SocketModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity])
  ],
  providers: [MqttService],
  controllers: [MqttController],
  exports: [MqttService], // Export để dùng ở module khác
})
export class MqttModule {}