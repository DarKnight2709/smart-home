import { Injectable } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceType } from 'src/shared/enums/device.enum';
import { DeviceService } from '../device/device.service';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { Repository } from 'typeorm';

@Injectable()
export class BedroomService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly deviceService: DeviceService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly sensorSnapshot: Repository<RoomSensorSnapshotEntity>,
  ) {}

  getStatus() {
    return { status: 'Bedroom module is working!' };
  }

  async controlLight(state: boolean) {
    await this.mqttService.controlLight('bedroom', state);
  }

  async getDetails() {
    const devices = await this.deviceService.findAll('bedroom');

    const lightsOn = devices.filter(
      (d) => d.type === DeviceType.LIGHT && d.lastState === 'on',
    ).length;
    const lightsTotal = devices.filter(
      (d) => d.type === DeviceType.LIGHT,
    ).length;

    const doorsOpen = devices.filter(
      (d) => d.type === DeviceType.DOOR && d.lastState === 'open',
    ).length;
    const doorsTotal = devices.filter((d) => d.type === DeviceType.DOOR).length;

    // temperature
    const sensorSnapshot = await this.sensorSnapshot.findOne({
      where: {
        location: 'bedroom',
      },
    });

    // thiết bị online
    // const devicesOnline = devices.filter((d) => d.status === DeviceStatus.ONLINE).length;

    // const devicesTotal = devices.length;

    console.log({
      location: 'bedroom',
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        lastState: d.lastState,
        status: d.status,
      })),
      ...sensorSnapshot,
      lightsOn,
      lightsTotal,
      doorsOpen,
      doorsTotal,
    });
    return {
      location: 'bedroom',
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        lastState: d.lastState,
        status: d.status,
      })),
      ...sensorSnapshot,
      lightsOn,
      lightsTotal,
      doorsOpen,
      doorsTotal,
    };
  }
}
