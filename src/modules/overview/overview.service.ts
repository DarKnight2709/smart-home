import { getDeviceStatistics } from './../../shared/utils/getDeviceStatistics';
// overview.service.ts
import { Injectable } from '@nestjs/common';
import { DeviceService } from '../device/device.service';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceOverviewDto, OverviewStateDto } from './overview.dto';
import { DeviceStatus, DeviceType } from 'src/shared/enums/device.enum';
import { LivingRoomService } from '../living-room/living-room.service';
import { BedroomService } from '../bedroom/bedroom.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';

@Injectable()
export class OverviewService {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly mqttService: MqttService,
    private readonly livingRoomMqttService: LivingRoomService,
    private readonly bedroomMqttService: BedroomService,
    private readonly kitchenMqttService: KitchenService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly roomSensorSnapshotRepo: Repository<RoomSensorSnapshotEntity>,
  ) {}

  // Lấy trạng thái tổng quan và danh sách thiết bị
  async getOverview() {
    // gọi socket để lấy báo cho các phòng gửi các dữ liệu sensor

    const rooms = await this.roomSensorSnapshotRepo.find();

    const devices = await this.deviceService.findAll();

    const deviceStatistics = getDeviceStatistics(devices);

    return {
      quickStatus: {
        ...deviceStatistics
      },
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        location: device.location,
        lastState: device.lastState,
        status: device.status,
      })),
      rooms: rooms,
    };
  }

  async controlAllLights(state: boolean) {
    try {
      // Gửi lệnh MQTT tới từng phòng
      await this.livingRoomMqttService.controlLight(state);
      await this.bedroomMqttService.controlLight(state);
      // Nếu có kitchen service
      await this.kitchenMqttService.controlLight(state);

      // Cập nhật trạng thái trong database
      // await this.deviceService.updateMany(
      //   { type: DeviceType.LIGHT },
      //   { lastState: state ? 'on' : 'off' }
      // );

      return { success: true };
    } catch (error) {
      console.error('Error controlling all lights:', error);
      throw new Error('Không thể điều khiển tất cả đèn');
    }
  }

  async controlAllDoors(state: boolean) {
    try {
      // Gửi lệnh MQTT tới từng phòng
      await this.livingRoomMqttService.controlDoor(state);
      // await this.bedroomMqttService.controlDoor(state);
      // Nếu có kitchen service
      // await this.kitchenMqttService.controlDoor(state);

      // Cập nhật trạng thái trong database
      // await this.deviceService.updateMany(
      //   { type: DeviceType.DOOR },
      //   { lastState: state ? 'open' : 'closed' }
      // );

      return { success: true };
    } catch (error) {
      console.error('Error controlling all doors:', error);
      throw new Error('Không thể điều khiển tất cả cửa');
    }
  }

  // Optionally: điều khiển thiết bị từ overview
  // async controlDevice(deviceId: string, command: string) {
  //   const device = await this.deviceService.findById(deviceId);
  //   if (!device) throw new Error('Device not found');

  //   const room = device.location;
  //   const type = device.type;

  //   if (type === 'light') {
  //     await this.mqttService.controlLight(room, command === 'ON');
  //   } else if (type === 'door') {
  //     await this.mqttService.controlDoor(room, command === 'UNLOCK');
  //   }

  //   // update lastState
  //   await this.deviceService.updateStatus(deviceId, command);
  // }
}
