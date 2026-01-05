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
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditStatus } from 'src/database/entities/audit-log.entity';

@Injectable()
export class BedroomService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly deviceService: DeviceService,
    private readonly auditLogService: AuditLogService,
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
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (phòng ngủ): Đèn không tồn tại`,
        metadata: {
          location: 'bedroom',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy đèn ${deviceId} trong phòng ngủ`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (phòng ngủ): Đèn đang offline`,
        metadata: {
          location: 'bedroom',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'OFFLINE',
        },
      });
      throw new BadRequestException(`Đèn ${deviceId} đang offline`);
    }

    try {
      await this.mqttService.controlSpecificLight('bedroom', deviceId, state);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} ${device.name} thành công (phòng ngủ)`,
        metadata: {
          location: 'bedroom',
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
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (phòng ngủ): Lỗi khi gửi lệnh tới thiết bị`,
        metadata: {
          location: 'bedroom',
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
      where: { location: 'bedroom', type: DeviceType.LIGHT },
    });

    if (lights.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (phòng ngủ): Không tìm thấy đèn nào`,
        metadata: {
          location: 'bedroom',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'NO_DEVICES',
        },
      });
      throw new NotFoundException('Không tìm thấy đèn nào trong phòng ngủ');
    }

    const onlineLights = lights.filter(light => light.status === DeviceStatus.ONLINE);
    
    if (onlineLights.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (phòng ngủ): Tất cả đèn đang offline`,
        metadata: {
          location: 'bedroom',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          total: lights.length,
          online: 0,
          reason: 'ALL_OFFLINE',
        },
      });
      throw new BadRequestException('Tất cả đèn phòng ngủ đang offline');
    }

    try {
      // Điều khiển từng đèn online
      for (const light of onlineLights) {
        await this.mqttService.controlSpecificLight('bedroom', light.id, state);
      }
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thành công (phòng ngủ): ${state ? 'Bật' : 'Tắt'} ${onlineLights.length}/${lights.length} đèn`,
        metadata: {
          location: 'bedroom',
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
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (phòng ngủ): Lỗi khi gửi lệnh`,
        metadata: {
          location: 'bedroom',
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
      where: { location: 'bedroom', type: DeviceType.DOOR },
    });

    if (doors.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (phòng ngủ): Không tìm thấy cửa nào`,
        metadata: {
          location: 'bedroom',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          reason: 'NO_DEVICES',
        },
      });
      throw new NotFoundException('Không tìm thấy cửa nào trong phòng ngủ');
    }

    const onlineDoors = doors.filter(door => door.status === DeviceStatus.ONLINE);
    
    if (onlineDoors.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (phòng ngủ): Tất cả cửa đang offline`,
        metadata: {
          location: 'bedroom',
          deviceType: DeviceType.DOOR,
          desiredState: state,
          total: doors.length,
          online: 0,
          reason: 'ALL_OFFLINE',
        },
      });
      throw new BadRequestException('Tất cả cửa phòng ngủ đang offline');
    }

    try {
      // Điều khiển từng cửa online
      for (const door of onlineDoors) {
        await this.mqttService.controlSpecificDoor('bedroom', door.id, state);
      }
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'ALL_DOORS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thành công (phòng ngủ): ${state ? 'Mở' : 'Đóng'} ${onlineDoors.length}/${doors.length} cửa`,
        metadata: {
          location: 'bedroom',
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
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa thất bại (phòng ngủ): Lỗi khi gửi lệnh`,
        metadata: {
          location: 'bedroom',
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
    // Kiểm tra device có tồn tại và thuộc phòng bedroom không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'bedroom', type: DeviceType.DOOR },
    });

    if (!device) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa thất bại (phòng ngủ): Cửa không tồn tại`,
        metadata: {
          location: 'bedroom',
          deviceId,
          deviceType: DeviceType.DOOR,
          desiredState: state,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy cửa ${deviceId} trong phòng ngủ`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa thất bại (phòng ngủ): Cửa đang offline`,
        metadata: {
          location: 'bedroom',
          deviceId,
          deviceType: DeviceType.DOOR,
          desiredState: state,
          reason: 'OFFLINE',
        },
      });
      throw new BadRequestException(`Cửa ${deviceId} đang offline`);
    }

    try {
      await this.mqttService.controlSpecificDoor('bedroom', deviceId, state);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} ${device.name} thành công (phòng ngủ)`,
        metadata: {
          location: 'bedroom',
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
        description: `${state ? 'Mở' : 'Đóng'} cửa thất bại (phòng ngủ): Lỗi khi gửi lệnh tới thiết bị`,
        metadata: {
          location: 'bedroom',
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

    // Tìm door device theo deviceId trong bedroom
    const doorDevice = await this.deviceRepository.findOne({
      where: {
        id: deviceId,
        location: 'bedroom',
        type: DeviceType.DOOR,
      },
      select: {
        id: true,
        name: true,
        password: true,
      },
    });

    if (!doorDevice) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi mật khẩu cửa thất bại (phòng ngủ): Cửa không tồn tại`,
        metadata: {
          location: 'bedroom',
          deviceId,
          deviceType: DeviceType.DOOR,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy cửa ${deviceId} trong phòng ngủ`);
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
        await this.mqttService.publishPassword('bedroom', deviceId, newPassword);

        await this.auditLogService.logCustom({
          action: AuditAction.CUSTOM,
          status: AuditStatus.SUCCESS,
          entityName: 'Device',
          entityId: deviceId,
          description: `Đặt mật khẩu ${doorDevice.name} thành công (phòng ngủ)`,
          metadata: {
            location: 'bedroom',
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
          description: `Đặt mật khẩu ${doorDevice.name} thất bại (phòng ngủ)`,
          metadata: {
            location: 'bedroom',
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
        description: `Đổi mật khẩu cửa thất bại (phòng ngủ): Mật khẩu cũ không đúng`,
        metadata: {
          location: 'bedroom',
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
      await this.mqttService.publishPassword('bedroom', deviceId, newPassword);

      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi mật khẩu ${doorDevice.name} thành công (phòng ngủ)`,
        metadata: {
          location: 'bedroom',
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
        description: `Đổi mật khẩu ${doorDevice.name} thất bại (phòng ngủ)`,
        metadata: {
          location: 'bedroom',
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
      await this.auditLogService.logCustom({
        action: AuditAction.UPDATE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi tên thiết bị thất bại (phòng ngủ): Thiết bị không tồn tại`,
        metadata: {
          location: 'bedroom',
          deviceId,
          newName: name,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy thiết bị ${deviceId} trong phòng ngủ`);
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
        description: `Đổi tên ${device.name} thành công (phòng ngủ): "${oldName}" → "${name}"`,
        metadata: {
          location: 'bedroom',
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
        description: `Đổi tên ${device.name} thất bại (phòng ngủ): "${oldName}" → "${name}"`,
        metadata: {
          location: 'bedroom',
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
      await this.deviceService.deleteDeviceInLocation('bedroom', deviceId);
      await this.auditLogService.logCustom({
        action: AuditAction.DELETE,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `Xóa thiết bị thành công (phòng ngủ)`,
        metadata: {
          location: 'bedroom',
          deviceId,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.DELETE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Xóa thiết bị thất bại (phòng ngủ)`,
        metadata: {
          location: 'bedroom',
          deviceId,
        },
        error,
      });
      throw error;
    }
    return {
      success: true,
      message: `Đã xóa thiết bị ${deviceId} khỏi phòng ngủ`,
    };
  }
}
