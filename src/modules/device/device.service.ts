import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../../database/entities/device.entity'
import { UpsertDeviceDto } from './device.dto'
import { DeviceType, DeviceStatus } from 'src/shared/enums/device.enum'

@Injectable()
export class DeviceService {
  constructor(@InjectRepository(Device) private deviceRepo: Repository<Device>) {}

  async upsert(dto: UpsertDeviceDto) {
    const existing = await this.deviceRepo.findOne({ where: { id: dto.id } })
    console.log("Existing device:", dto.id);
    if (existing) {
      return this.deviceRepo.save({ ...existing, 
        location: dto.location ?? existing.location,
        lastState: dto.lastState ?? existing.lastState,
        status: dto.status ?? existing.status,
       })
    }
    return this.deviceRepo.save(this.deviceRepo.create(dto))
  }

  // async updateStatus(id: string, status: 'online' | 'offline') {
  //   await this.repo.update({ id }, { status, lastSeen: new Date() })
  // }

  

  async findAll(location?: string) {
    if (location) {
      return this.deviceRepo.find({ where: { location } })
    }
    return this.deviceRepo.find()
  }

  // Kiểm tra xem thiết bị cụ thể (theo type) có online không
  async isDeviceTypeOnline(location: string, deviceType: DeviceType): Promise<boolean> {
    const devices = await this.deviceRepo.find({ 
      where: { 
        location,
        type: deviceType
      },
      select: ['status', 'type']
    });
    
    // Nếu không có thiết bị loại này hoặc tất cả đều offline → return false
    if (devices.length === 0) {
      return false;
    }
    
    // Kiểm tra xem có ít nhất 1 thiết bị loại này online không
    return devices.some(device => device.status === DeviceStatus.ONLINE);
  }

  // Lấy số lượng thiết bị online theo type
  async getDeviceTypeStatus(location: string, deviceType: DeviceType): Promise<{
    total: number;
    online: number;
    offline: number;
  }> {
    const devices = await this.deviceRepo.find({ 
      where: { 
        location,
        type: deviceType
      },
      select: ['status']
    });
    
    const online = devices.filter(d => d.status === DeviceStatus.ONLINE).length;
    const offline = devices.filter(d => d.status === DeviceStatus.OFFLINE).length;
    
    return {
      total: devices.length,
      online,
      offline
    };
  }

  // Update device name
  async updateDeviceName(deviceId: string, name: string): Promise<Device> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }
    
    device.name = name;
    return await this.deviceRepo.save(device);
  }

  async deleteDeviceInLocation(location: string, deviceId: string) {
    const device = await this.deviceRepo.findOne({
      where: { id: deviceId, location },
      select: ['id', 'location', 'status'],
    })

    if (!device) {
      throw new NotFoundException(
        `Không tìm thấy thiết bị ${deviceId} trong phòng ${location}`,
      )
    }

    if (device.status !== DeviceStatus.OFFLINE) {
      throw new BadRequestException(
        `Chỉ có thể xóa thiết bị offline (${deviceId})`,
      )
    }

    await this.deviceRepo.delete({ id: deviceId, location })
    return { success: true }
  }
}