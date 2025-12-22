import { getDeviceStatistics } from './../../shared/utils/getDeviceStatistics';
import { Injectable } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceService } from '../device/device.service';
import { DeviceStatus, DeviceType } from 'src/shared/enums/device.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { Repository } from 'typeorm';

@Injectable()
export class LivingRoomService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly deviceService: DeviceService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly sensorSnapshot: Repository<RoomSensorSnapshotEntity>
  ) {}

  async getSensorData() {
    await this.mqttService.getSensorData('living-room');
  }

  async controlLight(state: boolean) {
    await this.mqttService.controlLight('living-room', state);
  }

  async controlDoor(state: boolean) {
    await this.mqttService.controlDoor('living-room', state);
  }

  async getDetails() {
    const devices = await this.deviceService.findAll("living-room");

    const deviceStatistics = getDeviceStatistics(devices);

    // temperature
    const sensorSnapshot = await this.sensorSnapshot.findOne({where: {
      location: "living-room"
    }})


    return {
      location: 'living-room',
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        lastState: d.lastState,
        status: d.status,
      })),
      ...sensorSnapshot,
      ...deviceStatistics
    }
  }
}
