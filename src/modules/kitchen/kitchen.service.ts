import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MqttService } from '../mqtt/mqtt.service';
import { DeviceService } from '../device/device.service';
import { RoomSensorSnapshotEntity } from 'src/database/entities/sensor-data.entity';
import { getDeviceStatistics } from 'src/shared/utils/getDeviceStatistics';
import { DeviceType, DeviceStatus } from 'src/shared/enums/device.enum';
import { Device } from 'src/database/entities/device.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditStatus } from 'src/database/entities/audit-log.entity';

@Injectable()
export class KitchenService {
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
    await this.mqttService.getSensorData('kitchen');
  }


  async controlSpecificLight(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng kitchen không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'kitchen', type: DeviceType.LIGHT },
    });

    if (!device) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (nhà bếp): Đèn không tồn tại`,
        metadata: {
          location: 'kitchen',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy đèn ${deviceId} trong nhà bếp`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (nhà bếp): Đèn đang offline`,
        metadata: {
          location: 'kitchen',
          deviceId,
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'OFFLINE',
        },
      });
      throw new BadRequestException(`Đèn ${deviceId} đang offline`);
    }

    try {
      await this.mqttService.controlSpecificLight('kitchen', deviceId, state);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Bật' : 'Tắt'} ${device.name} thành công (nhà bếp)`,
        metadata: {
          location: 'kitchen',
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
        description: `${state ? 'Bật' : 'Tắt'} đèn thất bại (nhà bếp): Lỗi khi gửi lệnh tới thiết bị`,
        metadata: {
          location: 'kitchen',
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
      where: { location: 'kitchen', type: DeviceType.LIGHT },
    });

    if (lights.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (nhà bếp): Không tìm thấy đèn nào`,
        metadata: {
          location: 'kitchen',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          reason: 'NO_DEVICES',
        },
      });
      throw new NotFoundException('Không tìm thấy đèn nào trong nhà bếp');
    }

    const onlineLights = lights.filter(light => light.status === DeviceStatus.ONLINE);
    
    if (onlineLights.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (nhà bếp): Tất cả đèn đang offline`,
        metadata: {
          location: 'kitchen',
          deviceType: DeviceType.LIGHT,
          desiredState: state,
          total: lights.length,
          online: 0,
          reason: 'ALL_OFFLINE',
        },
      });
      throw new BadRequestException('Tất cả đèn nhà bếp đang offline');
    }

    try {
      // Điều khiển từng đèn online
      for (const light of onlineLights) {
        await this.mqttService.controlSpecificLight('kitchen', light.id, state);
      }
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'ALL_LIGHTS',
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thành công (nhà bếp): ${state ? 'Bật' : 'Tắt'} ${onlineLights.length}/${lights.length} đèn`,
        metadata: {
          location: 'kitchen',
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
        description: `${state ? 'Bật' : 'Tắt'} tất cả đèn thất bại (nhà bếp): Lỗi khi gửi lệnh`,
        metadata: {
          location: 'kitchen',
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

  async controlAllWindows(state: boolean) {
    const windows = await this.deviceRepository.find({
      where: { location: 'kitchen', type: DeviceType.WINDOW },
    });

    if (windows.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_WINDOWS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ thất bại (nhà bếp): Không tìm thấy cửa sổ nào`,
        metadata: {
          location: 'kitchen',
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          reason: 'NO_DEVICES',
        },
      });
      throw new NotFoundException('Không tìm thấy cửa sổ nào trong nhà bếp');
    }

    const onlineWindows = windows.filter(window => window.status === DeviceStatus.ONLINE);
    
    if (onlineWindows.length === 0) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_WINDOWS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ thất bại (nhà bếp): Tất cả cửa sổ đang offline`,
        metadata: {
          location: 'kitchen',
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          total: windows.length,
          online: 0,
          reason: 'ALL_OFFLINE',
        },
      });
      throw new BadRequestException('Tất cả cửa sổ nhà bếp đang offline');
    }

    try {
      // Điều khiển từng cửa online
      for (const window of onlineWindows) {
        await this.mqttService.controlSpecificWindow('kitchen', window.id, state);
      }
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'ALL_WINDOWS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ thành công (nhà bếp): ${state ? 'Mở' : 'Đóng'} ${onlineWindows.length}/${windows.length} cửa sổ`,
        metadata: {
          location: 'kitchen',
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          total: windows.length,
          online: onlineWindows.length,
          deviceIds: onlineWindows.map((w) => w.id),
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'ALL_WINDOWS',
        description: `${state ? 'Mở' : 'Đóng'} tất cả cửa sổ thất bại (nhà bếp): Lỗi khi gửi lệnh`,
        metadata: {
          location: 'kitchen',
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          total: windows.length,
          online: onlineWindows.length,
          deviceIds: onlineWindows.map((w) => w.id),
        },
        error,
      });
      throw error;
    }
  }



  async controlSpecificWindow(deviceId: string, state: boolean) {
    // Kiểm tra device có tồn tại và thuộc phòng kitchen không
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, location: 'kitchen', type: DeviceType.WINDOW },
    });

    if (!device) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa sổ thất bại (nhà bếp): Cửa sổ không tồn tại`,
        metadata: {
          location: 'kitchen',
          deviceId,
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy cửa sổ ${deviceId} trong nhà bếp`);
    }

    if (device.status === DeviceStatus.OFFLINE) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa sổ thất bại (nhà bếp): Cửa sổ đang offline`,
        metadata: {
          location: 'kitchen',
          deviceId,
          deviceType: DeviceType.WINDOW,
          desiredState: state,
          reason: 'OFFLINE',
        },
      });
      throw new BadRequestException(`Cửa sổ ${deviceId} đang offline`);
    }

    try {
      await this.mqttService.controlSpecificWindow('kitchen', deviceId, state);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} ${device.name} thành công (nhà bếp)`,
        metadata: {
          location: 'kitchen',
          deviceId,
          deviceType: DeviceType.WINDOW,
          desiredState: state,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `${state ? 'Mở' : 'Đóng'} cửa sổ thất bại (nhà bếp): Lỗi khi gửi lệnh tới thiết bị`,
        metadata: {
          location: 'kitchen',
          deviceId,
          deviceType: DeviceType.WINDOW,
          desiredState: state,
        },
        error,
      });
      throw error;
    }
  }

  async commandAuto(state: boolean) {
    const message = state ? 'ON' : 'OFF';
    try {
      await this.mqttService.sendAutoCommand('kitchen', message);
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: 'AUTO_MODE',
        description: `Chuyển chế độ tự động thành công (nhà bếp): ${message}`,
        metadata: {
          location: 'kitchen',
          operation: 'auto_mode',
          desiredState: state,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.CUSTOM,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: 'AUTO_MODE',
        description: `Chuyển chế độ tự động thất bại (nhà bếp): ${message}`,
        metadata: {
          location: 'kitchen',
          operation: 'auto_mode',
          desiredState: state,
        },
        error,
      });
      throw error;
    }
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
      await this.auditLogService.logCustom({
        action: AuditAction.UPDATE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Đổi tên thiết bị thất bại (nhà bếp): Thiết bị không tồn tại`,
        metadata: {
          location: 'kitchen',
          deviceId,
          newName: name,
          reason: 'NOT_FOUND',
        },
      });
      throw new NotFoundException(`Không tìm thấy thiết bị ${deviceId} trong nhà bếp`);
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
        description: `Đổi tên ${device.name} thành công (nhà bếp): "${oldName}" → "${name}"`,
        metadata: {
          location: 'kitchen',
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
        description: `Đổi tên ${device.name} thất bại (nhà bếp): "${oldName}" → "${name}"`,
        metadata: {
          location: 'kitchen',
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
      await this.deviceService.deleteDeviceInLocation('kitchen', deviceId);
      await this.auditLogService.logCustom({
        action: AuditAction.DELETE,
        status: AuditStatus.SUCCESS,
        entityName: 'Device',
        entityId: deviceId,
        description: `Xóa thiết bị thành công (nhà bếp)`,
        metadata: {
          location: 'kitchen',
          deviceId,
        },
      });
    } catch (error) {
      await this.auditLogService.logCustom({
        action: AuditAction.DELETE,
        status: AuditStatus.FAILED,
        entityName: 'Device',
        entityId: deviceId,
        description: `Xóa thiết bị thất bại (nhà bếp)`,
        metadata: {
          location: 'kitchen',
          deviceId,
        },
        error,
      });
      throw error;
    }
    return {
      success: true,
      message: `Đã xóa thiết bị ${deviceId} khỏi nhà bếp`,
    };
  }
}
