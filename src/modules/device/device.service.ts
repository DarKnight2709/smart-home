import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../../database/entities/device.entity'
import { UpsertDeviceDto } from './device.dto'

@Injectable()
export class DeviceService {
  constructor(@InjectRepository(Device) private deviceRepo: Repository<Device>) {}

  async upsert(dto: UpsertDeviceDto) {
    const existing = await this.deviceRepo.findOne({ where: { id: dto.id } })
    if (existing) {
      return this.deviceRepo.save({ ...existing, ...dto })
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
}