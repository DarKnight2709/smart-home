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
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditStatus } from 'src/database/entities/audit-log.entity';

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
    private readonly auditLogService: AuditLogService,
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
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (tổng quan)`,
        metadata: {
          scope: 'overview',
          operation: 'controlAllLights',
          desiredState: state,
          results,
        },
      });
      // Tất cả đều thất bại
      throw new BadRequestException({
        message: 'Không thể điều khiển đèn ở bất kỳ phòng nào. Tất cả thiết bị đang offline.',
        results,
      });
    }

    await this.auditLogService.logCustom({
      action: AuditAction.CUSTOM,
      status: failedRooms.length > 0 ? AuditStatus.PARTIAL : AuditStatus.SUCCESS,
      entityName: 'Device',
      entityId: 'ALL_LIGHTS',
      description:
        failedRooms.length > 0
          ? `${state ? 'Bật' : 'Tắt'} tất cả đèn một phần: Thành công ${successCount}/${rooms.length} phòng`
          : `${state ? 'Bật' : 'Tắt'} tất cả đèn thành công`,
      metadata: {
        scope: 'overview',
        operation: 'controlAllLights',
        desiredState: state,
        successCount,
        totalRooms: rooms.length,
        results,
      },
    });

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
    ];

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

    const successCount = results.filter((r) => r.success).length;
    const failedRooms = results.filter((r) => !r.success);

    if (successCount === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (tổng quan)`,
        metadata: {
          scope: 'overview',
          operation: 'controlAllDoors',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          results,
        },
      });
      throw new BadRequestException({
        message: 'Không thể điều khiển cửa ở bất kỳ phòng nào. Tất cả thiết bị đang offline.',
        results,
      });
    }

    await this.auditLogService.logCustom({
      action: AuditAction.CUSTOM,
      status: failedRooms.length > 0 ? AuditStatus.PARTIAL : AuditStatus.SUCCESS,
      entityName: 'Device',
      entityId: 'ALL_DOORS',
      description:
        failedRooms.length > 0
          ? `${state ? 'Mở' : 'Đóng'} tất cả cửa một phần (tổng quan): ${state ? 'Mở' : 'Đóng'} cửa (${successCount}/${rooms.length} phòng thành công)`
          : `${state ? 'Mở' : 'Đóng'} tất cả cửa thành công (tổng quan)`,
      metadata: {
        scope: 'overview',
        operation: 'controlAllDoors',
        deviceType: DeviceType.DOOR,
        desiredState: state,
        successCount,
        totalRooms: rooms.length,
        results,
      },
    });

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

    const successCount = results.filter((r) => r.success).length;
    const failedRooms = results.filter((r) => !r.success);

    if (successCount === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_WINDOWS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ thất bại (tổng quan)`,
        metadata: {
          scope: 'overview',
          operation: 'controlAllWindows',
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          results,
        },
      });
      throw new BadRequestException({
        message: 'Không thể điều khiển cửa sổ ở bất kỳ phòng nào. Tất cả thiết bị đang offline.',
        results,
      });
    }

    await this.auditLogService.logCustom({
      action: AuditAction.CUSTOM,
      status: failedRooms.length > 0 ? AuditStatus.PARTIAL : AuditStatus.SUCCESS,
      entityName: 'Device',
      entityId: 'ALL_WINDOWS',
      description:
        failedRooms.length > 0
          ? `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ một phần (tổng quan): ${state ? 'Mở' : 'Đóng'} cửa sổ (${successCount}/${rooms.length} phòng thành công)`
          : `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ thành công (tổng quan)`,
      metadata: {
        scope: 'overview',
        operation: 'controlAllWindows',
        deviceType: DeviceType.WINDOW,
        desiredState: state,
        successCount,
        totalRooms: rooms.length,
        results,
      },
    });

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

}
