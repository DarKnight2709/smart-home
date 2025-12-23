import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingEntity } from '../../database/entities/setting.entity';
import { SettingResponseDto, UpdateSettingDto } from './setting.dto';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(SettingEntity)
    private settingRepository: Repository<SettingEntity>,
  ) {}

  async findAll(): Promise<SettingResponseDto[]> {
    const settings = await this.settingRepository.find();

    return settings.map((setting) => ({
      sensorType: setting.sensorType,
      min: setting.minValue,
      max: setting.maxValue,
    }));
  }

  async findOne(id: string): Promise<SettingEntity> {
    const setting = await this.settingRepository.findOne({ where: { id } });
    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }
    return setting;
  }

  async findBySensorType(sensorType: string): Promise<SettingEntity | null> {
    return this.settingRepository.findOne({
      where: { sensorType },
    });
  }

  async update(updateSettingDto: UpdateSettingDto) {
    if (updateSettingDto.temperature) {
      await this.upsertSensorSetting(
        'temperature',
        updateSettingDto.temperature.min,
        updateSettingDto.temperature.max,
      );
    }

    if (updateSettingDto.humidity) {
      await this.upsertSensorSetting(
        'humidity',
        updateSettingDto.humidity.min,
        updateSettingDto.humidity.max,
      );
    }

    if (updateSettingDto.gas) {
      await this.upsertSensorSetting(
        'gas',
        updateSettingDto.gas.min,
        updateSettingDto.gas.max,
      );
    }
  }

  async upsertSensorSetting(
    sensorType: 'temperature' | 'humidity' | 'gas',
    minValue: number,
    maxValue: number,
  ) {
    const existed = await this.settingRepository.findOne({
      where: { sensorType },
    });

    if (existed) {
      await this.settingRepository.update(
        { sensorType },
        { minValue, maxValue },
      );
    } else {
      await this.settingRepository.save(
        this.settingRepository.create({
          sensorType,
          minValue,
          maxValue,
        }),
      );
    }
  }
}
