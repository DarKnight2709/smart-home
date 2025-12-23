import { RoomSensorSnapshotEntity } from './../../database/entities/sensor-data.entity';
import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { SharedModule } from '../../shared/shared.module';
import { DeviceModule } from '../device/device.module';
import { SocketModule } from '../socket/socket.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingModule } from '../setting/setting.module';

@Global()
@Module({
  imports: [SharedModule, DeviceModule, SocketModule, SettingModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity])
  ],
  providers: [MqttService],
  exports: [MqttService], // Export để dùng ở module khác
})
export class MqttModule {}