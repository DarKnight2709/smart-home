// overview.module.ts
import { Module } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { OverviewController } from './overview.controller';
import { DeviceModule } from '../device/device.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { LivingRoomModule } from '../living-room/living-room.module';
import { BedroomModule } from '../bedroom/bedroom.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [DeviceModule, LivingRoomModule, BedroomModule, KitchenModule,
    AuditLogModule,
    TypeOrmModule.forFeature([RoomSensorSnapshotEntity]),
  ],
  providers: [OverviewService],
  controllers: [OverviewController],
  exports: [OverviewService],
})
export class OverviewModule {}
