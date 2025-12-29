import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceType, DeviceStatus } from 'src/shared/enums/device.enum';
import { DeviceService } from '../device/device.service';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { Repository } from 'typeorm';
import { getDeviceStatistics } from 'src/shared/utils/getDeviceStatistics';
import { Device } from 'src/database/entities/device.entity';
import { ChangeDoorPasswordDto } from './bedroom.dto';
import { UpdateDeviceNameDto } from '../device/device.dto';

@Injectable()
export class BedroomService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly deviceService: DeviceService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly sensorSnapshot: Repository<RoomSensorSnapshotEntity>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}



  async controlSpecificLight(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng bedroom không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'bedroom', type: DeviceType.LIGHT },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy đèn ${deviceId} trong phòng ngủ`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      throw new BadRequestException(`Đèn ${deviceId} đang offline`);
    }

    await this.mqttService.controlSpecificLight('bedroom', deviceId, state);
  }


  async controlAllLights(state: boolean) {
    const lights = await this.deviceRepository.find({
      where: { location: 'bedroom', type: DeviceType.LIGHT },
    });

    if (lights.length === 0) {
      throw new NotFoundException('Không tìm thấy đèn nào trong phòng ngủ');
    }

    const onlineLights = lights.filter(light => light.status === DeviceStatus.ONLINE);
    
    if (onlineLights.length === 0) {
      throw new BadRequestException('Tất cả đèn phòng ngủ đang offline');
    }

    // Điều khiển từng đèn online
    for (const light of onlineLights) {
      await this.mqttService.controlSpecificLight('bedroom', light.id, state);
    }
  }

  async controlAllDoors(state: boolean) {
    const doors = await this.deviceRepository.find({
      where: { location: 'bedroom', type: DeviceType.DOOR },
    });

    if (doors.length === 0) {
      throw new NotFoundException('Không tìm thấy cửa nào trong phòng ngủ');
    }

    const onlineDoors = doors.filter(door => door.status === DeviceStatus.ONLINE);
    
    if (onlineDoors.length === 0) {
      throw new BadRequestException('Tất cả cửa phòng ngủ đang offline');
    }

    // Điều khiển từng cửa online
    for (const door of onlineDoors) {
      await this.mqttService.controlSpecificDoor('bedroom', door.id, state);
    }
  }



  async controlSpecificDoor(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng bedroom không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'bedroom', type: DeviceType.DOOR },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy cửa ${deviceId} trong phòng ngủ`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      throw new BadRequestException(`Cửa ${deviceId} đang offline`);
    }

    await this.mqttService.controlSpecificDoor('bedroom', deviceId, state);
  }

  async changeDoorPassword(deviceId: string, changePasswordDto: ChangeDoorPasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    // Tìm door device theo deviceId trong bedroom
    const doorDevice = await this.deviceRepository.findOne({
      where: {
        id: deviceId,
        location: 'bedroom',
        type: DeviceType.DOOR,
      },
      select: {
        id: true,
        password: true,
      },
    });

    if (!doorDevice) {
      throw new NotFoundException(`Không tìm thấy cửa ${deviceId} trong phòng ngủ`);
    }

    // Nếu chưa có password (lần đầu set password)
    if (!doorDevice.password) {
      // Lưu password plain text vào DB
      await this.deviceRepository.update(
        { id: doorDevice.id },
        { password: newPassword },
      );
      // Gửi password mới đến wokwi qua MQTT
      await this.mqttService.publishPassword('bedroom', deviceId, newPassword);
      return { success: true, message: `Đã đặt mật khẩu mới cho cửa ${deviceId}` };
    }

    // Kiểm tra mật khẩu cũ (plain text comparison)
    if (oldPassword !== doorDevice.password) {
      throw new BadRequestException('Mật khẩu cũ không đúng');
    }

    // Lưu password plain text vào DB
    await this.deviceRepository.update(
      { id: doorDevice.id },
      { password: newPassword },
    );

    // Gửi password mới đến wokwi qua MQTT
    await this.mqttService.publishPassword('bedroom', deviceId, newPassword);

    return { success: true, message: `Đã đổi mật khẩu cửa ${deviceId} thành công` };
  }

  async getDetails() {
    const devices = await this.deviceService.findAll('bedroom');

    const deviceStatistics = getDeviceStatistics(devices);


    // temperature
    const sensorSnapshot = await this.sensorSnapshot.findOne({
      where: {
        location: 'bedroom',
      },
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
      ...deviceStatistics
    };
  }

  async updateDeviceName(deviceId: string, name: string) {
    // Verify device exists in bedroom
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'bedroom' },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy thiết bị ${deviceId} trong phòng ngủ`);
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
}
