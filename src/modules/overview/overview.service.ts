import { getDeviceStatistics } from './../../shared/utils/getDeviceStatistics';
// overview.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
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

interface RoomControlResult {
  room: string;
  success: boolean;
  message?: string;
  error?: string;
}

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
    const results: RoomControlResult[] = [];
    const rooms = [
      { name: 'living-room', displayName: 'Phòng khách', service: this.livingRoomMqttService },
      { name: 'bedroom', displayName: 'Phòng ngủ', service: this.bedroomMqttService },
      { name: 'kitchen', displayName: 'Nhà bếp', service: this.kitchenMqttService },
    ];

    // Kiểm tra trạng thái tất cả các phòng
    for (const room of rooms) {
      try {
        await room.service.controlAllLights(state);
        results.push({
          room: room.displayName,
          success: true,
          message: `Đã ${state ? 'bật' : 'tắt'} đèn ${room.displayName}`,
        });
      } catch (error) {
        results.push({
          room: room.displayName,
          success: false,
          error: error.message || `Không thể điều khiển đèn ${room.displayName}`,
        });
      }
    }
    console.log("results", results);

    // Kiểm tra xem có phòng nào thành công không
    const successCount = results.filter((r) => r.success).length;
    const failedRooms = results.filter((r) => !r.success);

    if (successCount === 0) {
      // Tất cả đều thất bại
      throw new BadRequestException({
        message: 'Không thể điều khiển đèn ở bất kỳ phòng nào. Tất cả thiết bị đang offline.',
        results,
      });
    }

    // Một số phòng thành công, một số thất bại
    return {
      success: true,
      message: `Đã ${state ? 'bật' : 'tắt'} đèn thành công ${successCount}/${rooms.length} phòng`,
      successCount,
      totalRooms: rooms.length,
      results,
      ...(failedRooms.length > 0 && {
        warning: `Không thể điều khiển: ${failedRooms.map((r) => r.room).join(', ')}`,
      }),
    };
  }

  async controlAllDoors(state: boolean) {
    const results: RoomControlResult[] = [];
    const rooms = [
      { name: 'living-room', displayName: 'Phòng khách', service: this.livingRoomMqttService },
      { name: 'bedroom', displayName: 'Phòng ngủ', service: this.bedroomMqttService },
      // { name: 'kitchen', displayName: 'Nhà bếp', service: this.kitchenMqttService },
    ];

    // Kiểm tra trạng thái tất cả các phòng
    for (const room of rooms) {
      try {
        await room.service.controlAllDoors(state);
        results.push({
          room: room.displayName,
          success: true,
          message: `Đã ${state ? 'mở' : 'đóng'} cửa ${room.displayName}`,
        });
      } catch (error) {
        results.push({
          room: room.displayName,
          success: false,
          error: error.message || `Không thể điều khiển cửa ${room.displayName}`,
        });
      }
    }

    // Kiểm tra xem có phòng nào thành công không
    const successCount = results.filter((r) => r.success).length;
    const failedRooms = results.filter((r) => !r.success);

    if (successCount === 0) {
      // Tất cả đều thất bại
      throw new BadRequestException({
        message: 'Không thể điều khiển cửa ở bất kỳ phòng nào. Tất cả thiết bị đang offline.',
        results,
      });
    }

    // Một số phòng thành công, một số thất bại
    return {
      success: true,
      message: `Đã ${state ? 'mở' : 'đóng'} cửa thành công ${successCount}/${rooms.length} phòng`,
      successCount,
      totalRooms: rooms.length,
      results,
      ...(failedRooms.length > 0 && {
        warning: `Không thể điều khiển: ${failedRooms.map((r) => r.room).join(', ')}`,
      }),
    };
  }

  async controlAllWindows(state: boolean) {
    const results: RoomControlResult[] = [];
    const rooms = [
      { name: 'kitchen', displayName: 'Nhà bếp', service: this.kitchenMqttService },
    ];

    // Kiểm tra trạng thái tất cả các phòng
    for (const room of rooms) {
      try {
        await room.service.controlAllWindows(state);
        results.push({
          room: room.displayName,
          success: true,
          message: `Đã ${state ? 'mở' : 'đóng'} cửa sổ ${room.displayName}`,
        });
      } catch (error) {
        results.push({
          room: room.displayName,
          success: false,
          error: error.message || `Không thể điều khiển cửa sổ ${room.displayName}`,
        });
      }
    }

    // Kiểm tra xem có phòng nào thành công không
    const successCount = results.filter((r) => r.success).length;
    const failedRooms = results.filter((r) => !r.success);

    if (successCount === 0) {
      // Tất cả đều thất bại
      throw new BadRequestException({
        message: 'Không thể điều khiển cửa sổ ở bất kỳ phòng nào. Tất cả thiết bị đang offline.',
        results,
      });
    }

    // Một số phòng thành công, một số thất bại
    return {
      success: true,
      message: `Đã ${state ? 'mở' : 'đóng'} cửa sổ thành công ${successCount}/${rooms.length} phòng`,
      successCount,
      totalRooms: rooms.length,
      results,
      ...(failedRooms.length > 0 && {
        warning: `Không thể điều khiển: ${failedRooms.map((r) => r.room).join(', ')}`,
      }),
    };
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
