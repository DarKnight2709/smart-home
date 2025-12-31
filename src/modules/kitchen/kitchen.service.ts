import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MqttService } from '../mqtt/mqtt.service';
import { DeviceService } from '../device/device.service';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { getDeviceStatistics } from 'src/shared/utils/getDeviceStatistics';
import { DeviceType, DeviceStatus } from 'src/shared/enums/device.enum';
import { Device } from 'src/database/entities/device.entity';

@Injectable()
export class KitchenService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly deviceService: DeviceService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly sensorSnapshot: Repository<RoomSensorSnapshotEntity>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async getSensorData() {
    await this.mqttService.getSensorData('kitchen');
  }


  async controlSpecificLight(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng kitchen không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'kitchen', type: DeviceType.LIGHT },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy đèn ${deviceId} trong nhà bếp`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      throw new BadRequestException(`Đèn ${deviceId} đang offline`);
    }

    await this.mqttService.controlSpecificLight('kitchen', deviceId, state);
  }



  async controlAllLights(state: boolean) {
    const lights = await this.deviceRepository.find({
      where: { location: 'kitchen', type: DeviceType.LIGHT },
    });

    if (lights.length === 0) {
      throw new NotFoundException('Không tìm thấy đèn nào trong nhà bếp');
    }

    const onlineLights = lights.filter(light => light.status === DeviceStatus.ONLINE);
    
    if (onlineLights.length === 0) {
      throw new BadRequestException('Tất cả đèn nhà bếp đang offline');
    }

    // Điều khiển từng đèn online
    for (const light of onlineLights) {
      await this.mqttService.controlSpecificLight('kitchen', light.id, state);
    }
  }

  async controlAllWindows(state: boolean) {
    const windows = await this.deviceRepository.find({
      where: { location: 'kitchen', type: DeviceType.WINDOW },
    });

    if (windows.length === 0) {
      throw new NotFoundException('Không tìm thấy cửa sổ nào trong nhà bếp');
    }

    const onlineWindows = windows.filter(window => window.status === DeviceStatus.ONLINE);
    
    if (onlineWindows.length === 0) {
      throw new BadRequestException('Tất cả cửa sổ nhà bếp đang offline');
    }

    // Điều khiển từng cửa online
    for (const window of onlineWindows) {
      await this.mqttService.controlSpecificWindow('kitchen', window.id, state);
    }
  }



  async controlSpecificWindow(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng kitchen không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'kitchen', type: DeviceType.WINDOW },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy cửa sổ ${deviceId} trong nhà bếp`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      throw new BadRequestException(`Cửa sổ ${deviceId} đang offline`);
    }

    await this.mqttService.controlSpecificWindow('kitchen', deviceId, state);
  }

  async commandAuto(state: boolean) {
    const message = state ? 'ON' : 'OFF';
    await this.mqttService.sendAutoCommand('kitchen', message);
  }

  async getDetails() {
    const devices = await this.deviceService.findAll('kitchen');

    const deviceStatistics = getDeviceStatistics(devices);

    const sensorSnapshot = await this.sensorSnapshot.findOne({
      where: {
        location: 'kitchen',
      },
    });

    return {
      location: 'kitchen',
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        lastState: d.lastState,
        status: d.status,
      })),
      ...sensorSnapshot,
      ...deviceStatistics,
    };
  }

  async updateDeviceName(deviceId: string, name: string) {
    // Verify device exists in kitchen
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'kitchen' },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy thiết bị ${deviceId} trong nhà bếp`);
    }

    const updated = await this.deviceService.updateDeviceName(deviceId, name);
    return {
      success: true,
      message: 'Đã cập nhật tên thiết bị thành công',
      device: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
      }
    };
  }

  async deleteDevice(deviceId: string) {
    await this.deviceService.deleteDeviceInLocation('kitchen', deviceId);
    return {
      success: true,
      message: `Đã xóa thiết bị ${deviceId} khỏi nhà bếp`,
    };
  }
}
