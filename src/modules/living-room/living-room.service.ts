import { getDeviceStatistics } from './../../shared/utils/getDeviceStatistics';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceService } from '../device/device.service';
import { DeviceStatus, DeviceType } from 'src/shared/enums/device.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { Repository } from 'typeorm';
import { Device } from 'src/database/entities/device.entity';
import { ChangeDoorPasswordDto } from './living-room.dto';
import { UpdateDeviceNameDto } from '../device/device.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditStatus } from 'src/database/entities/audit-log.entity';

@Injectable()
export class LivingRoomService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly deviceService: DeviceService,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(RoomSensorSnapshotEntity)
    private readonly sensorSnapshot: Repository<RoomSensorSnapshotEntity>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async getSensorData() {
    await this.mqttService.getSensorData('living-room');
  }



  async controlSpecificLight(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng living-room không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'living-room', type: DeviceType.LIGHT },
    });

    if (!device) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (phòng khách): Đèn không tồn tại`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy đèn trong phòng khách`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (phòng khách): Đèn đang offline`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'OFFLINE',
        },
      });
      throw new BadRequestException(`Đèn ${deviceId} đang offline`);
    }

    try {
      await this.mqttService.controlSpecificLight('living-room', deviceId, state);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} ${device.name} thành công (phòng khách)`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (phòng khách): Lỗi khi gửi lệnh tới thiết bị`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
        },
        error,
      });
      throw error;
    }
  }



  async controlAllLights(state: boolean) {
    const lights = await this.deviceRepository.find({
      where: { location: 'living-room', type: DeviceType.LIGHT },
    });

    if (lights.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (phòng khách): Không tìm thấy đèn nào`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'NO_DEVICES',
        },
      });
      throw new NotFoundException('Không tìm thấy đèn nào trong phòng khách');
    }

    const onlineLights = lights.filter(light => light.status === DeviceStatus.ONLINE);
    
    if (onlineLights.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (phòng khách): Tất cả đèn đang offline`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          total: lights.length,
          online: 0,
          reason: 'ALL_OFFLINE',
        },
      });
      throw new BadRequestException('Tất cả đèn phòng khách đang offline');
    }

    try {
      // Điều khiển từng đèn online
      for (const light of onlineLights) {
        await this.mqttService.controlSpecificLight('living-room', light.id, state);
      }
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thành công (phòng khách): ${state ? 'Bật' : 'Tắt'} ${onlineLights.length}/${lights.length} đèn`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          total: lights.length,
          online: onlineLights.length,
          deviceIds: onlineLights.map((l) => l.id),
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (phòng khách): Lỗi khi gửi lệnh`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          total: lights.length,
          online: onlineLights.length,
          deviceIds: onlineLights.map((l) => l.id),
        },
        error,
      });
      throw error;
    }
  }

  async controlAllDoors(state: boolean) {
    const doors = await this.deviceRepository.find({
      where: { location: 'living-room', type: DeviceType.DOOR },
    });

    if (doors.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (phòng khách): Không tìm thấy cửa nào`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          reason: 'NO_DEVICES',
        },
      });
      throw new NotFoundException('Không tìm thấy cửa nào trong phòng khách');
    }

    const onlineDoors = doors.filter(door => door.status === DeviceStatus.ONLINE);
    
    if (onlineDoors.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (phòng khách): Tất cả cửa đang offline`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          total: doors.length,
          online: 0,
          reason: 'ALL_OFFLINE',
        },
      });
      throw new BadRequestException('Tất cả cửa phòng khách đang offline');
    }

    try {
      // Điều khiển từng cửa online
      for (const door of onlineDoors) {
        await this.mqttService.controlSpecificDoor('living-room', door.id, state);
      }
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thành công (phòng khách): ${state ? 'Mở' : 'Đóng'} ${onlineDoors.length}/${doors.length} cửa`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          total: doors.length,
          online: onlineDoors.length,
          deviceIds: onlineDoors.map((d) => d.id),
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (phòng khách): Lỗi khi gửi lệnh`,
        metadata: {
          location: 'living-room',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          total: doors.length,
          online: onlineDoors.length,
          deviceIds: onlineDoors.map((d) => d.id),
        },
        error,
      });
      throw error;
    }
  }



  async controlSpecificDoor(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng living-room không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'living-room', type: DeviceType.DOOR },
    });

    if (!device) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa thất bại (phòng khách): Cửa không tồn tại`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          desiredState: state,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy cửa trong phòng khách`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa thất bại (phòng khách): Cửa đang offline`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          desiredState: state,
          reason: 'OFFLINE',
        },
      });
      throw new BadRequestException(`Cửa ${deviceId} đang offline`);
    }

    try {
      await this.mqttService.controlSpecificDoor('living-room', deviceId, state);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} ${device.name} thành công (phòng khách)`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          desiredState: state,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa thất bại (phòng khách): Lỗi khi gửi lệnh tới thiết bị`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          desiredState: state,
        },
        error,
      });
      throw error;
    }
  }

  async changeDoorPassword(deviceId: string, changePasswordDto: ChangeDoorPasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    // Tìm door device theo deviceId trong living-room
    const doorDevice = await this.deviceRepository.findOne({
      where: {
        id: deviceId,
        location: 'living-room',
        type: DeviceType.DOOR,
      },
      select: {
        id: true,
        password: true,
      },
    });

    if (!doorDevice) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi mật khẩu cửa thất bại (phòng khách): Cửa không tồn tại`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy cửa trong phòng khách`);
    }

    // Nếu chưa có password (lần đầu set password)
    if (!doorDevice.password) {
      try {
        // Lưu password plain text vào DB
        await this.deviceRepository.update(
          { id: doorDevice.id },
          { password: newPassword },
        );
        // Gửi password mới đến wokwi qua MQTT
        await this.mqttService.publishPassword('living-room', deviceId, newPassword);
        await this.auditLogService.logCustom({
          action: AuditAction.CUSTOM,
          status: AuditStatus.SUCCESS,
          entityName: 'Device',
          entityId: deviceId,
          description: `Đặt mật khẩu ${doorDevice.name} thành công (phòng khách)`,
          metadata: {
            location: 'living-room',
            deviceId,
            deviceType: DeviceType.DOOR,
            operation: 'set_password_first_time',
          },
        });
      } catch (error) {
        await this.auditLogService.logCustom({
          action: AuditAction.CUSTOM,
          status: AuditStatus.FAILED,
          entityName: 'Device',
          entityId: deviceId,
          description: `Đặt mật khẩu ${doorDevice.name} thất bại (phòng khách)`,
          metadata: {
            location: 'living-room',
            deviceId,
            deviceType: DeviceType.DOOR,
            operation: 'set_password_first_time',
          },
          error,
        });
        throw error;
      }
      return { success: true, message: `Đã đặt mật khẩu mới cho ${doorDevice.name}` };
    }

    // Kiểm tra mật khẩu cũ (plain text comparison)
    if (oldPassword !== doorDevice.password) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi mật khẩu ${doorDevice.name} thất bại (phòng khách): Mật khẩu cũ không đúng`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          reason: 'INVALID_OLD_PASSWORD',
        },
      });
      throw new BadRequestException('Mật khẩu cũ không đúng');
    }

    try {
      // Lưu password plain text vào DB
      await this.deviceRepository.update(
        { id: doorDevice.id },
        { password: newPassword },
      );

      // Gửi password mới đến wokwi qua MQTT
      await this.mqttService.publishPassword('living-room', deviceId, newPassword);

      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi mật khẩu ${doorDevice.name} thành công (phòng khách)`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          operation: 'change_password',
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi mật khẩu ${doorDevice.name} thất bại (phòng khách)`,
        metadata: {
          location: 'living-room',
          deviceId,
          deviceType: DeviceType.DOOR,
          operation: 'change_password',
        },
        error,
      });
      throw error;
    }

    return { success: true, message: `Đã đổi mật khẩu ${doorDevice.name} thành công` };
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

  async updateDeviceName(deviceId: string, name: string) {
    // Verify device exists in living-room
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'living-room' },
    });

    if (!device) {
      await this.auditLogService.logCustom({
        action: AuditAction.UPDATE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi tên thiết bị thất bại (phòng khách): Thiết bị không tồn tại`,
        metadata: {
          location: 'living-room',
          deviceId,
          newName: name,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy thiết bị trong phòng khách`);
    }

    const oldName = device.name;
    let updated: Device;
    try {
      updated = await this.deviceService.updateDeviceName(deviceId, name);
      await this.auditLogService.logCustom({
        action: AuditAction.UPDATE,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        changedFields: ['name'],
        oldValues: { name: oldName },
        newValues: { name },
        description: `Đổi tên ${device.name} thành công (phòng khách): "${oldName}" → "${name}"`,
        metadata: {
          location: 'living-room',
          deviceId,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.UPDATE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        changedFields: ['name'],
        oldValues: { name: oldName },
        newValues: { name },
        description: `Đổi tên ${device.name} thất bại (phòng khách): "${oldName}" → "${name}"`,
        metadata: {
          location: 'living-room',
          deviceId,
        },
        error,
      });
      throw error;
    }
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
    try {
      await this.deviceService.deleteDeviceInLocation('living-room', deviceId);
      await this.auditLogService.logCustom({
        action: AuditAction.DELETE,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `Xóa thiết bị thành công (phòng khách)`,
        metadata: {
          location: 'living-room',
          deviceId,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.DELETE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Xóa thiết bị thất bại (phòng khách)`,
        metadata: {
          location: 'living-room',
          deviceId,
        },
        error,
      });
      throw error;
    }
    return {
      success: true,
      message: `Đã xóa thiết bị khỏi phòng khách`,
    };
  }
}
